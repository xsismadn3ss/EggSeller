import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
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

export function createMcpServer(): McpServer {
  const server = new McpServer({ name: "eggseller", version: "1.0.0" });

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
    "preferencias_cliente",
    {
      description: "Hábitos de compra de un cliente: monto, categorías y productos favoritos",
      inputSchema: {
        cliente: z.string().describe("Nombre exacto del cliente"),
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
        "Todo lo necesario para sugerir un cargamento en UNA sola llamada: totales del periodo y por producto con kg, monto y tendencia % vs periodo anterior equivalente",
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
