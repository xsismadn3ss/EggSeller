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
  cliente: z.string().trim().min(2),
  zonaGeografica: z.string().trim().min(2),
  canalDistribucion: z.string().trim().min(2),
  canalVenta: z.enum(CANALES_VENTA),
  producto: z.string().trim().min(2),
  categoria: z.string().trim().min(2),
  cantidad: z.number().positive(),
  precioUnitario: z.number().positive(),
  monto: z.number().positive().optional(),
  fuente: z.enum(FUENTES).default("api"),
});

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
  return {
    fecha,
    cliente: get("Cliente", "cliente"),
    zonaGeografica: get("Zona_Geografica", "zonaGeografica"),
    canalDistribucion: get("Canal_Distribucion", "canalDistribucion"),
    canalVenta: get("Canal_Venta", "canalVenta"),
    producto: get("Producto", "producto"),
    categoria: get("Categoria", "categoria"),
    cantidad: num(get("Cantidad_kg_unid", "cantidad")),
    precioUnitario: num(get("Precio_Unitario_USD", "precioUnitario")),
    monto: num(get("Monto_Venta_USD", "monto")),
    fuente,
  };
}
