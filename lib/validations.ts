import { z } from "zod";

export const CANALES_VENTA = ["Horeca", "Mayorista", "Retail"] as const;
export const FUENTES = ["excel", "csv", "api"] as const;

const fechaSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "fecha debe ser YYYY-MM-DD")
  .refine((v) => {
    const d = new Date(`${v}T00:00:00`);
    if (Number.isNaN(d.getTime())) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return d <= today;
  }, "fecha no puede ser futura ni inválida");

export const ventaSchema = z.object({
  fecha: fechaSchema,
  // Formato clásico (Demo_Ventas.xlsx)
  cliente: z.string().trim().min(2).optional(),
  zonaGeografica: z.string().trim().min(2).optional(),
  canalDistribucion: z.string().trim().min(2).optional(),
  canalVenta: z.string().trim().min(1).optional(),
  // Formato puntos 2024-2025 (Demo_Ventas_2024_2025.xlsx)
  punto: z.string().trim().min(2).optional(),
  nombrePunto: z.string().trim().min(1).optional(),
  canal: z.string().trim().min(1).optional(),
  region: z.string().trim().min(1).optional(),
  producto: z.string().trim().min(2),
  categoria: z.string().trim().min(2),
  cantidad: z.number().positive(),
  precioUnitario: z.number().positive(),
  moneda: z.enum(["USD", "BRL"]).default("USD"),
  monto: z.number().positive().optional(),
  anio: z.number().int().min(2000).max(2100).optional(),
  mes: z.number().int().min(1).max(12).optional(),
  stockDisponible: z.number().min(0).optional(),
  leadTimeDias: z.number().min(0).optional(),
  promocion: z.boolean().optional(),
  devoluciones: z.number().min(0).optional(),
  pedidoSugerido: z.number().min(0).optional(),
  montoNeto: z.number().min(0).optional(),
  demanda30d: z.number().min(0).optional(),
  stockSeguridad: z.number().min(0).optional(),
  fuente: z.enum(FUENTES).default("api"),
}).refine(
  (v) => v.cliente || v.punto,
  { message: "Se requiere cliente (formato clásico) o punto (formato 2024-2025)" },
).refine(
  (v) => {
    if (v.punto) return true;
    return Boolean(v.cliente && v.zonaGeografica && v.canalDistribucion && v.canalVenta);
  },
  { message: "Sin punto se requieren cliente, zona, canales" },
);

export type VentaInput = z.infer<typeof ventaSchema>;

export interface VentaNormalizada extends Omit<VentaInput, "monto"> {
  monto: number;
}

export function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Valida y normaliza una fila: calcula monto si falta, verifica ±0.01 si viene. */
export function normalizeVenta(input: unknown): VentaNormalizada {
  const parsed = ventaSchema.parse(input);
  const calculado = round2(parsed.cantidad * parsed.precioUnitario);
  if (parsed.monto !== undefined && Math.abs(parsed.monto - calculado) > 0.01) {
    throw new Error(
      `monto ${parsed.monto} no coincide con cantidad*precioUnitario=${calculado}`,
    );
  }
  return { ...parsed, monto: calculado };
}

/** Mapea headers Excel/CSV (Fecha, Cliente, ...) al contrato API. */
export function mapRowToVentaInput(
  row: Record<string, unknown>,
  fuente: (typeof FUENTES)[number],
): unknown {
  const get = (...keys: string[]): unknown => {
    for (const k of keys) {
      if (row[k] !== undefined && row[k] !== null && row[k] !== "") return row[k];
    }
    return undefined;
  };
  const fechaRaw = get("Fecha", "fecha");
  let fecha: unknown = fechaRaw;
  if (fechaRaw instanceof Date) fecha = fechaRaw.toISOString().slice(0, 10);
  else if (typeof fechaRaw === "number") {
    // Serial Excel -> fecha (días desde 1899-12-30)
    const d = new Date(Math.round((fechaRaw - 25569) * 86400 * 1000));
    fecha = d.toISOString().slice(0, 10);
  } else if (typeof fechaRaw === "string" && fechaRaw.includes("/")) {
    const [d, m, y] = fechaRaw.split(/[/\-.]/).map((s) => s.trim());
    if (y?.length === 4) fecha = `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  const num = (v: unknown): number | undefined => {
    if (typeof v === "number") return v;
    if (typeof v === "string") {
      const n = Number(v.replace(/,/g, "").trim());
      return Number.isNaN(n) ? undefined : n;
    }
    return undefined;
  };
  const bool = (v: unknown): boolean | undefined => {
    if (typeof v === "boolean") return v;
    if (typeof v === "string") {
      const t = v.trim().toLowerCase();
      if (["sí", "si", "yes", "true", "1", "s"].includes(t)) return true;
      if (["no", "false", "0", "n"].includes(t)) return false;
    }
    if (typeof v === "number") return v !== 0;
    return undefined;
  };
  const moneda: "USD" | "BRL" =
    row.moneda === "BRL" || row.moneda === "USD"
      ? row.moneda
      : Object.keys(row).some((k) => /R\$|reais|real|brl/i.test(k))
        ? "BRL"
        : "USD";
  return {
    fecha,
    cliente: get("Cliente", "cliente"),
    zonaGeografica: get("Zona_Geografica", "zonaGeografica"),
    canalDistribucion: get("Canal_Distribucion", "canalDistribucion"),
    canalVenta: get("Canal_Venta", "canalVenta"),
    punto: get("Punto", "punto"),
    nombrePunto: get("Nombre_Punto", "nombrePunto"),
    canal: get("Canal", "canal"),
    region: get("Región", "Region", "region"),
    producto: get("Producto", "producto"),
    categoria: get("Categoria", "Categoría", "categoria"),
    cantidad: num(get("Cantidad_kg_unid", "Unidades", "cantidad")),
    precioUnitario: num(get("Precio_Unitario_USD", "Precio_Unitario_R$", "precioUnitario")),
    moneda,
    monto: num(get("Monto_Venta_USD", "Ventas_R$", "monto")),
    anio: num(get("Año", "anio")),
    mes: num(get("Mes", "mes")),
    stockDisponible: num(get("Stock_Disponible_Unidades", "stockDisponible")),
    leadTimeDias: num(get("Lead_Time_Días", "leadTimeDias")),
    promocion: bool(get("Promoción", "promocion")),
    devoluciones: num(get("Devoluciones_Unidades", "devoluciones")),
    pedidoSugerido: num(get("Pedido_Sugerido_Base", "pedidoSugerido")),
    montoNeto: num(get("Ventas_Netas_R$", "montoNeto")),
    demanda30d: num(get("Demanda_30d_Estimada", "demanda30d")),
    stockSeguridad: num(get("Stock_Seguridad_20pct", "stockSeguridad")),
    fuente,
  };
}

/** Campos destino que el wizard de mapeo IA puede sugerir. */
export const CAMPOS_DESTINO = [
  "fecha",
  "cliente",
  "zonaGeografica",
  "canalDistribucion",
  "canalVenta",
  "punto",
  "nombrePunto",
  "canal",
  "region",
  "producto",
  "categoria",
  "cantidad",
  "precioUnitario",
  "monto",
  "anio",
  "mes",
  "stockDisponible",
  "leadTimeDias",
  "promocion",
  "devoluciones",
  "pedidoSugerido",
  "montoNeto",
  "demanda30d",
  "stockSeguridad",
] as const;
