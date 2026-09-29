import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getSession } from "./neo4j";
import { getDashboardData, getResumenCargamento, parseFilters } from "./dashboard";

const filtrosSchema = {
  desde: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("Fecha inicio YYYY-MM-DD"),
  hasta: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("Fecha fin YYYY-MM-DD"),
  cliente: z.string().optional().describe("Nombre exacto del cliente"),
  categoria: z.string().optional().describe("Nombre exacto de la categoría"),
  producto: z.string().optional().describe("Nombre exacto del producto"),
  zona: z.string().optional().describe("Zona geográfica"),
  canalVenta: z.string().optional().describe("Horeca | Mayorista | Retail"),
  canalDist: z.string().optional().describe("Canal de distribución"),
};

const text = (data: unknown) => ({
  content: [{ type: "text" as const, text: JSON.stringify(data) }],
});

const MAX_ROWS = 50;

// Solo lectura: debe empezar con cláusula de lectura y no puede contener
// escrituras, APOC/GDS ni múltiples sentencias.
const WRITE_RE =
  /\b(create|merge|delete|detach|set|remove|drop|load\s+csv|foreach|call\s+(?!db\.)|apoc\.|gds\.)/i;

export async function runReadOnlyCypher(query: string): Promise<{
  columns: string[];
  rows: Record<string, unknown>[];
  truncated: boolean;
}> {
  const clean = query
    .replace(/\/\/[^\n]*/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .trim();
  if (!clean) throw new Error("Consulta vacía");
  if (clean.includes(";")) throw new Error("Una sola sentencia por llamada");
  if (!/^(match|optional\s+match|with|unwind|call)\b/i.test(clean)) {
    throw new Error("Solo se permiten consultas de lectura (MATCH/WITH/UNWIND/CALL db.*)");
  }
  if (WRITE_RE.test(clean)) {
    throw new Error("Escritura no permitida: solo lectura");
  }
  const session = getSession();
  try {
    const res = await session.run(clean, {}, { timeout: 15000 });
    const columns = (res.records[0]?.keys ?? []).map(String);
    const rows = res.records.slice(0, MAX_ROWS).map((r) => {
      const o: Record<string, unknown> = {};
      for (const k of columns) o[k] = toJson(r.get(k));
      return o;
    });
    return { columns, rows, truncated: res.records.length > MAX_ROWS };
  } finally {
    await session.close();
  }
}

function toJson(v: unknown): unknown {
  if (v === null || v === undefined) return null;
  if (typeof v === "object" && v !== null && "toNumber" in (v as object)) {
    return (v as { toNumber: () => number }).toNumber();
  }
  if (typeof v === "object" && v !== null && "toString" in v) {
    const s = (v as { toString: () => string }).toString();
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s;
  }
  if (Array.isArray(v)) return v.map(toJson);
  if (typeof v === "object") {
    const o: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(v)) o[k] = toJson(val);
    return o;
  }
  return v;
}

export function createMcpServer(): McpServer {
  const server = new McpServer({ name: "eggseller", version: "1.0.0" });

  server.registerTool(
    "ejecutar_cypher",
    {
      description:
        "Ejecuta CUALQUIER consulta Cypher de SOLO LECTURA en Neo4j y devuelve filas JSON. Úsala para preguntas abiertas o cuando no sepas los valores exactos: primero explora (ej. MATCH (z:ZonaGeografica) RETURN DISTINCT z.nombre) y luego agrega. Esquema: nodos Cliente, Venta, Producto, Categoria, ZonaGeografica, CanalDistribucion, CanalVenta; relaciones REALIZO, INCLUYE_PRODUCTO, PERTENECE_A, POR_CANAL_DIST, POR_CANAL_VENTA, UBICADO_EN. Venta{ventaId, fecha(date), cantidad, precioUnitario, monto, fuente}. Máximo 50 filas.",
      inputSchema: {
        query: z
          .string()
          .min(1)
          .max(2000)
          .describe("Consulta Cypher de solo lectura (sin punto y coma)"),
      },
    },
    async (args) => {
      try {
        return text(await runReadOnlyCypher(args.query));
      } catch (e) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error: ${e instanceof Error ? e.message : String(e)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );


  server.registerTool(
    "ventas_resumen",
    {
      description: "KPIs de ventas (monto, kg, tickets, clientes, ticket promedio) con filtros opcionales",
      inputSchema: filtrosSchema,
    },
    async (args) => {
      const data = await getDashboardData(parseFilters(args));
      return text({ kpis: data.kpis, rango: { desde: args.desde, hasta: args.hasta } });
    },
  );

  server.registerTool(
    "top_productos",
    {
      description: "Productos más vendidos por monto, con filtros opcionales de fecha",
      inputSchema: {
        desde: filtrosSchema.desde,
        hasta: filtrosSchema.hasta,
        limite: z.number().int().min(1).max(20).optional().describe("Cuántos productos devolver (default 8)"),
      },
    },
    async (args) => {
      const { limite, ...rest } = args;
      const data = await getDashboardData(parseFilters(rest));
      return text(data.topProductos.slice(0, limite ?? 8));
    },
  );

  server.registerTool(
    "top_clientes",
    {
      description:
        "Quiénes son los clientes y cuáles compran más: ranking por monto con ventas, última compra y producto favorito. Úsala también para obtener el nombre exacto antes de llamar a preferencias_cliente",
      inputSchema: {
        desde: filtrosSchema.desde,
        hasta: filtrosSchema.hasta,
        limite: z.number().int().min(1).max(20).optional().describe("Cuántos clientes devolver (default 10)"),
      },
    },
    async (args) => {
      const { limite, ...rest } = args;
      const data = await getDashboardData(parseFilters(rest));
      return text(data.topClientes.slice(0, limite ?? 10));
    },
  );

  server.registerTool(
    "preferencias_cliente",
    {
      description: "Hábitos de compra de UN cliente: monto, categorías y productos favoritos. El nombre exacto se obtiene primero con top_clientes",
      inputSchema: {
        cliente: z.string().describe("Nombre exacto del cliente (ver top_clientes)"),
        desde: filtrosSchema.desde,
        hasta: filtrosSchema.hasta,
      },
    },
    async (args) => {
      const data = await getDashboardData(parseFilters({ ...args, cliente: args.cliente }));
      if (data.kpis.tickets === 0) {
        return { content: [{ type: "text" as const, text: `Sin ventas para ${args.cliente}` }], isError: true };
      }
      return text({
        cliente: args.cliente,
        kpis: data.kpis,
        porCategoria: data.porCategoria,
        topProductos: data.topProductos,
      });
    },
  );

  server.registerTool(
    "resumen_cargamento",
    {
      description:
        "Pedidos sugeridos por producto con la regla pedido = MAX(0, demanda histórica + 20% seguridad − stock). Stock no registrado → stockDisponibleKg null. Una sola llamada para el próximo cargamento",
      inputSchema: { desde: filtrosSchema.desde, hasta: filtrosSchema.hasta },
    },
    async (args) => {
      const data = await getResumenCargamento(parseFilters(args));
      return text(data);
    },
  );

  server.registerTool(
    "ventas_por_categoria",
    {
      description: "Ventas agregadas por categoría de producto en un rango de fechas",
      inputSchema: { desde: filtrosSchema.desde, hasta: filtrosSchema.hasta },
    },
    async (args) => {
      const data = await getDashboardData(parseFilters(args));
      return text(data.porCategoria);
    },
  );

  return server;
}
