import { getSession } from "./neo4j";

export interface DashboardFilters {
  desde: string;
  hasta: string;
  cliente?: string;
  categoria?: string;
  producto?: string;
  zona?: string;
  canalVenta?: string;
  canalDist?: string;
  punto?: string;
}

export function parseFilters(
  sp: Record<string, string | string[] | undefined>,
): DashboardFilters {
  const one = (v: string | string[] | undefined): string | undefined =>
    Array.isArray(v) ? v[0] : v;
  const s = (v: string | string[] | undefined): string | undefined => {
    const o = one(v)?.trim();
    return o ? o : undefined;
  };
  return {
    desde: one(sp.desde) ?? "2025-01-01",
    hasta: one(sp.hasta) ?? "2025-12-31",
    cliente: s(sp.cliente),
    categoria: s(sp.categoria),
    producto: s(sp.producto),
    zona: s(sp.zona),
    canalVenta: s(sp.canalVenta),
    canalDist: s(sp.canalDist),
    punto: s(sp.punto),
  };
}

const MATCH_BASE = `
MATCH (v:Venta)-[:INCLUYE_PRODUCTO]->(p:Producto)-[:PERTENECE_A]->(cat:Categoria)
OPTIONAL MATCH (cli:Cliente)-[:REALIZO]->(v)
OPTIONAL MATCH (pt:PuntoExpress)-[:REGISTRO]->(v)
OPTIONAL MATCH (v)-[:POR_CANAL_DIST]->(cd)
OPTIONAL MATCH (v)-[:POR_CANAL_VENTA]->(cv)
OPTIONAL MATCH (cli)-[:UBICADO_EN]->(z)`;

function buildWhere(f: DashboardFilters, desde = "desde", hasta = "hasta") {
  const conds = [`v.fecha >= date($${desde})`, `v.fecha <= date($${hasta})`];
  const params: Record<string, unknown> = { [desde]: f.desde, [hasta]: f.hasta };
  const eq: [string, string | undefined][] = [
    ["cli.nombre", f.cliente],
    ["cat.nombre", f.categoria],
    ["p.nombre", f.producto],
    ["z.nombre", f.zona],
    ["cv.nombre", f.canalVenta],
    ["cd.nombre", f.canalDist],
    ["pt.codigo", f.punto],
  ];
  eq.forEach(([field, value], i) => {
    if (value) {
      const key = `f${i}`;
      conds.push(`${field} = $${key}`);
      params[key] = value;
    }
  });
  return { where: `WHERE ${conds.join(" AND ")}`, params };
}

export interface Kpis {
  monto: number;
  kg: number;
  tickets: number;
  clientes: number;
  ticketPromedio: number;
}

export interface SeriePunto {
  mes: string;
  monto: number;
  kg: number;
  tickets: number;
}

export interface TopProducto {
  producto: string;
  monto: number;
  kg: number;
  tickets: number;
}

export interface Grupo {
  nombre: string;
  monto: number;
  kg: number;
  tickets: number;
}

export interface TopCliente {
  cliente: string;
  monto: number;
  ventas: number;
  ultimaCompra: string;
  favorito: string;
}

export interface TopPunto {
  codigo: string;
  nombre: string;
  monto: number;
  ventas: number;
  ultimaCompra: string;
  favorito: string;
}

export interface Tendencia {
  producto: string;
  kg: number;
  kgPrev: number;
  tendenciaPct: number | null;
}

export interface DashboardData {
  kpis: Kpis;
  prev: Kpis;
  serie: SeriePunto[];
  topProductos: TopProducto[];
  tendencias: Tendencia[];
  porCategoria: Grupo[];
  porCanal: Grupo[];
  porZona: Grupo[];
  topClientes: TopCliente[];
  topPuntos: TopPunto[];
}

const num = (v: unknown): number =>
  typeof v === "object" && v !== null && "toNumber" in (v as object)
    ? (v as { toNumber: () => number }).toNumber()
    : Number(v ?? 0);

export function prevRange(f: DashboardFilters): { desde: string; hasta: string } {
  const d = new Date(`${f.desde}T00:00:00`);
  const h = new Date(`${f.hasta}T00:00:00`);
  const len = Math.max(0, Math.round((h.getTime() - d.getTime()) / 86400000));
  const hastaPrev = new Date(d.getTime() - 86400000);
  const desdePrev = new Date(hastaPrev.getTime() - len * 86400000);
  const iso = (x: Date) => x.toISOString().slice(0, 10);
  return { desde: iso(desdePrev), hasta: iso(hastaPrev) };
}

export interface PedidoSugerido {
  producto: string;
  demandaHistoricaKg: number;
  stockSeguridadKg: number;
  stockDisponibleKg: number | null;
  pedidoSugeridoKg: number;
  nota: string;
}

// Regla de negocio (documento de requerimientos):
// pedido = MAX(0, demanda estimada + stock de seguridad − stock disponible)
// donde demanda estimada = kg históricos del periodo y stock de seguridad = 20%.
// Stock disponible NO existe en el esquema actual → se reporta como null y el
// pedido se calcula sin restarlo. Si se modifica la regla, documentarlo aquí.
export const SEGURIDAD_PCT = 0.2;

export interface ResumenCargamento {
  desde: string;
  hasta: string;
  tickets: number;
  monto: number;
  kg: number;
  clientes: number;
  productos: PedidoSugerido[];
  regla: string;
}

/**
 * Agregado compacto en UN solo query para sugerencias de cargamento:
 * evita que el LLM haga 3-4 rondas de tools (eso es lo que tardaba minutos).
 */
export async function getResumenCargamento(
  f: DashboardFilters,
): Promise<ResumenCargamento> {
  const session = getSession();
  try {
    const r = await session.run(
      `MATCH (cli:Cliente)-[:REALIZO]->(v:Venta)-[:INCLUYE_PRODUCTO]->(p:Producto)
       WHERE v.fecha >= date($desde) AND v.fecha <= date($hasta)
       WITH count(v) AS tickets, sum(v.monto) AS monto, sum(v.cantidad) AS kg, count(DISTINCT cli) AS clientes
       RETURN tickets, monto, kg, clientes`,
      { desde: f.desde, hasta: f.hasta },
    );
    const k = r.records[0];
    const r2 = await session.run(
      `MATCH (v:Venta)-[:INCLUYE_PRODUCTO]->(p:Producto)
       WHERE v.fecha >= date($desde) AND v.fecha <= date($hasta)
       WITH p.nombre AS prod, sum(v.cantidad) AS kg, count(*) AS t
       RETURN prod, kg, t
       ORDER BY kg DESC`,
      { desde: f.desde, hasta: f.hasta },
    );
    return {
      desde: f.desde,
      hasta: f.hasta,
      tickets: num(k.get("tickets")),
      monto: Math.round(num(k.get("monto")) * 100) / 100,
      kg: num(k.get("kg")),
      clientes: num(k.get("clientes")),
      productos: r2.records.map((x) => {
        const demanda = num(x.get("kg"));
        const seguridad = Math.round(demanda * SEGURIDAD_PCT);
        return {
          producto: String(x.get("prod")),
          demandaHistoricaKg: demanda,
          stockSeguridadKg: seguridad,
          stockDisponibleKg: null,
          pedidoSugeridoKg: demanda + seguridad,
          nota: "Sin stock disponible registrado; revisar inventario real antes de pedir",
        };
      }),
      regla: `pedido = MAX(0, demanda histórica + ${SEGURIDAD_PCT * 100}% seguridad − stock). Stock no registrado → no se resta.`,
    };
  } finally {
    await session.close();
  }
}

// Caché en memoria (los datos solo cambian al subir ventas)
const dashCache = new Map<string, { exp: number; data: DashboardData }>();
const DASH_TTL_MS = 120_000;

export async function getDashboardDataCached(
  f: DashboardFilters,
): Promise<DashboardData> {
  const key = JSON.stringify(f);
  const hit = dashCache.get(key);
  if (hit && hit.exp > Date.now()) return hit.data;
  const data = await getDashboardData(f);
  dashCache.set(key, { exp: Date.now() + DASH_TTL_MS, data });
  return data;
}

export async function getDashboardData(
  f: DashboardFilters,
): Promise<DashboardData> {
  const session = getSession();
  try {
    const { where, params } = buildWhere(f);
    const prev = prevRange(f);
    const prevBuilt = buildWhere({ ...f, ...prev }, "pDesde", "pHasta");

    const kpisQ = `${MATCH_BASE} ${where} RETURN count(v) AS tickets, sum(v.monto) AS monto, sum(v.cantidad) AS kg, count(DISTINCT coalesce(cli.nombre, pt.codigo)) AS clientes`;
    // Secuencial: una sesión Neo4j no acepta queries concurrentes
    const cur = await session.run(kpisQ, params);
    const prv = await session.run(
      `${MATCH_BASE} ${prevBuilt.where} RETURN count(v) AS tickets, sum(v.monto) AS monto, sum(v.cantidad) AS kg, count(DISTINCT coalesce(cli.nombre, pt.codigo)) AS clientes`,
      { ...params, ...prevBuilt.params },
    );
    const toKpis = (r: { get: (k: string) => unknown }): Kpis => {
      const tickets = num(r.get("tickets"));
      const monto = num(r.get("monto"));
      return {
        tickets,
        monto,
        kg: num(r.get("kg")),
        clientes: num(r.get("clientes")),
        ticketPromedio: tickets > 0 ? monto / tickets : 0,
      };
    };
    const kpis = toKpis(cur.records[0]);
    const prevKpis = toKpis(prv.records[0]);

    const serieR = await session.run(
      `${MATCH_BASE} ${where} WITH v.fecha.year AS y, v.fecha.month AS m, sum(v.monto) AS monto, sum(v.cantidad) AS kg, count(*) AS tickets RETURN y, m, monto, kg, tickets ORDER BY y, m`,
      params,
    );
    const serie: SeriePunto[] = serieR.records.map((r) => ({
      mes: `${r.get("y")}-${String(num(r.get("m"))).padStart(2, "0")}`,
      monto: num(r.get("monto")),
      kg: num(r.get("kg")),
      tickets: num(r.get("tickets")),
    }));

    const topProdR = await session.run(
      `${MATCH_BASE} ${where} WITH p.nombre AS producto, sum(v.monto) AS monto, sum(v.cantidad) AS kg, count(*) AS tickets RETURN producto, monto, kg, tickets ORDER BY monto DESC LIMIT 8`,
      params,
    );
    const topProductos: TopProducto[] = topProdR.records.map((r) => ({
      producto: String(r.get("producto")),
      monto: num(r.get("monto")),
      kg: num(r.get("kg")),
      tickets: num(r.get("tickets")),
    }));

    const group = async (field: string): Promise<Grupo[]> => {
      const r = await session.run(
        `${MATCH_BASE} ${where} WITH ${field} AS nombre, sum(v.monto) AS monto, sum(v.cantidad) AS kg, count(*) AS tickets WHERE nombre IS NOT NULL RETURN nombre, monto, kg, tickets ORDER BY monto DESC`,
        params,
      );
      return r.records.map((x) => ({
        nombre: String(x.get("nombre")),
        monto: num(x.get("monto")),
        kg: num(x.get("kg")),
        tickets: num(x.get("tickets")),
      }));
    };
    const porCategoria = await group("cat.nombre");
    let porCanal = await group("cv.nombre");
    if (porCanal.length === 0) {
      // Dataset puntos: el canal vive en PuntoExpress, no en CanalVenta
      porCanal = await group("pt.canal");
    }
    const porZona = await group("z.nombre");

    const topCliR = await session.run(
      `${MATCH_BASE} ${where} WITH cli, p, sum(v.monto) AS m, count(v) AS n, max(v.fecha) AS u WHERE cli IS NOT NULL ORDER BY m DESC
       WITH cli, collect({nombre: p.nombre, m: m})[0] AS fav, sum(m) AS total, sum(n) AS ventas, max(u) AS ultima
       RETURN cli.nombre AS cliente, total, ventas, ultima, fav.nombre AS favorito ORDER BY total DESC LIMIT 10`,
      params,
    );
    const topClientes: TopCliente[] = topCliR.records.map((r) => ({
      cliente: String(r.get("cliente")),
      monto: num(r.get("total")),
      ventas: num(r.get("ventas")),
      ultimaCompra: String(r.get("ultima")),
      favorito: String(r.get("favorito")),
    }));

    const topPuntosR = await session.run(
      `${MATCH_BASE} ${where} WITH pt, p, sum(v.monto) AS m, count(v) AS n, max(v.fecha) AS u WHERE pt IS NOT NULL ORDER BY m DESC
       WITH pt, collect({nombre: p.nombre, m: m})[0] AS fav, sum(m) AS total, sum(n) AS ventas, max(u) AS ultima
       RETURN pt.codigo AS codigo, pt.nombre AS nombre, total, ventas, ultima, fav.nombre AS favorito ORDER BY total DESC LIMIT 10`,
      params,
    );
    const topPuntos: TopPunto[] = topPuntosR.records.map((r) => ({
      codigo: String(r.get("codigo")),
      nombre: String(r.get("nombre")),
      monto: num(r.get("total")),
      ventas: num(r.get("ventas")),
      ultimaCompra: String(r.get("ultima")),
      favorito: String(r.get("favorito")),
    }));

    // Tendencia por producto vs periodo anterior equivalente (mismos filtros)
    const trendPrevR = await session.run(
      `${MATCH_BASE} ${prevBuilt.where} WITH p.nombre AS prod, sum(v.cantidad) AS kgPrev RETURN prod, kgPrev`,
      { ...params, ...prevBuilt.params },
    );
    const prevMap = new Map(
      trendPrevR.records.map((r) => [String(r.get("prod")), num(r.get("kgPrev"))]),
    );
    const tendencias: Tendencia[] = topProductos.map((t) => {
      const kgPrev = prevMap.get(t.producto) ?? 0;
      return {
        producto: t.producto,
        kg: t.kg,
        kgPrev,
        tendenciaPct: kgPrev > 0 ? Math.round(((t.kg - kgPrev) * 100) / kgPrev) : null,
      };
    });

    return { kpis, prev: prevKpis, serie, topProductos, tendencias, porCategoria, porCanal, porZona, topClientes, topPuntos };
  } finally {
    await session.close();
  }
}

export interface FiltrosData {
  clientes: string[];
  categorias: string[];
  productos: string[];
  zonas: string[];
  canalesVenta: string[];
  canalesDist: string[];
  puntos: string[];
  desde: string;
  hasta: string;
}

const str = (v: unknown): string => String(v);

export async function getFiltros(): Promise<FiltrosData> {
  const session = getSession();
  try {
    const q = async (c: string) => {
      const r = await session.run(c);
      return r.records.map((x) => str(x.get(0))).sort();
    };
    const queries = [
      "MATCH (c:Cliente) RETURN DISTINCT c.nombre AS n ORDER BY n",
      "MATCH (c:Categoria) RETURN DISTINCT c.nombre AS n ORDER BY n",
      "MATCH (p:Producto) RETURN DISTINCT p.nombre AS n ORDER BY n",
      "MATCH (z:ZonaGeografica) RETURN DISTINCT z.nombre AS n ORDER BY n",
      "MATCH (c:CanalVenta) RETURN DISTINCT c.nombre AS n ORDER BY n",
      "MATCH (c:CanalDistribucion) RETURN DISTINCT c.nombre AS n ORDER BY n",
      "MATCH (pt:PuntoExpress) RETURN DISTINCT pt.codigo AS n ORDER BY n",
    ];
    // Secuencial: una sesión Neo4j no acepta queries concurrentes
    const lists: string[][] = [];
    for (const c of queries) lists.push(await q(c));
    const [clientes, categorias, productos, zonas, canalesVenta, canalesDist, puntos] = lists as [
      string[],
      string[],
      string[],
      string[],
      string[],
      string[],
      string[],
    ];
    const rango = await session.run(
      "MATCH (v:Venta) RETURN min(v.fecha) AS d, max(v.fecha) AS h",
    );
    return {
      clientes,
      categorias,
      productos,
      zonas,
      canalesVenta,
      canalesDist,
      puntos,
      desde: str(rango.records[0].get("d")),
      hasta: str(rango.records[0].get("h")),
    };
  } finally {
    await session.close();
  }
}
