export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import * as XLSX from "xlsx";
import { parse } from "csv-parse/sync";
import { CAMPOS_DESTINO } from "@/lib/validations";
import { chat } from "@/lib/opencode";

const MAX_BYTES = 5 * 1024 * 1024;

interface Columna {
  nombre: string;
  muestras: unknown[];
}

function preview(buffer: Buffer, filename: string): Columna[] {
  let rows: Record<string, unknown>[];
  if (/\.csv$/i.test(filename)) {
    rows = parse(buffer.toString("utf-8"), {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    }) as Record<string, unknown>[];
  } else {
    const wb = XLSX.read(buffer, { type: "buffer", cellDates: true });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    if (!sheet) throw new Error("Archivo sin hojas");
    rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      defval: null,
    });
  }
  if (rows.length === 0) throw new Error("Archivo sin filas de datos");
  const cols = Object.keys(rows[0]);
  return cols.map((nombre) => ({
    nombre,
    muestras: rows.slice(0, 3).map((r) => r[nombre]),
  }));
}

/** Mapeo por similitud (fallback sin IA): alias exactos primero, luego substring. */
const ALIAS: Record<string, string | null> = {
  fecha: "fecha",
  ano: "anio",
  mes: "mes",
  cliente: "cliente",
  zona: "zonaGeografica",
  zonageografica: "zonaGeografica",
  canal: "canal",
  canaldistribucion: "canalDistribucion",
  canalventa: "canalVenta",
  punto: "punto",
  nombrepunto: "nombrePunto",
  region: "region",
  producto: "producto",
  productoid: null,
  categoria: "categoria",
  unidades: "cantidad",
  cantidad: "cantidad",
  cantidadkgunid: "cantidad",
  preciounitario: "precioUnitario",
  preciounitariorusd: "precioUnitario",
  preciounitarior: "precioUnitario",
  monto: "monto",
  montoventausd: "monto",
  ventasr: "monto",
  stockdisponible: "stockDisponible",
  stockdisponibleunidades: "stockDisponible",
  leadtime: "leadTimeDias",
  leadtimedias: "leadTimeDias",
  promocion: "promocion",
  devoluciones: "devoluciones",
  devolucionesunidades: "devoluciones",
  pedidosugerido: "pedidoSugerido",
  pedidosugeridobase: "pedidoSugerido",
  montoneto: "montoNeto",
  ventasnetasr: "montoNeto",
  demanda30d: "demanda30d",
  demanda30destimada: "demanda30d",
  stockseguridad: "stockSeguridad",
  stockseguridad20pct: "stockSeguridad",
};

export function sugerirMapeoLocal(columnas: string[]): Record<string, string | null> {
  const norm = (s: string) =>
    s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
  const out: Record<string, string | null> = {};
  for (const col of columnas) {
    const c = norm(col);
    if (c in ALIAS) {
      out[col] = ALIAS[c];
      continue;
    }
    const hit = (CAMPOS_DESTINO as readonly string[]).find((d) => {
      const n = norm(d);
      return c === n || c.includes(n) || n.includes(c);
    });
    out[col] = hit ?? null;
  }
  return out;
}

const MAP_SYSTEM = `Eres un mapeador de columnas a JSON. Recibes columnas de un archivo de ventas con muestras y una lista de campos destino.
Responde SOLO con un objeto JSON plano donde cada clave es el nombre exacto de la columna origen y el valor es el campo destino o null si no corresponde.
Campos destino: fecha, cliente, zonaGeografica, canalDistribucion, canalVenta, punto, nombrePunto, canal, region, producto, categoria, cantidad, precioUnitario, monto, anio, mes, stockDisponible, leadTimeDias, promocion, devoluciones, pedidoSugerido, montoNeto, demanda30d, stockSeguridad.
Mapea también columnas de año/mes, stock disponible, lead time, promoción, devoluciones, pedido sugerido, ventas netas, demanda estimada y stock de seguridad cuando existan; solo usa null si de verdad no corresponde a ningún campo (ej. promedios calculados o IDs internos).
Sin explicaciones, sin markdown, solo JSON.`;

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return Response.json({ error: "Falta archivo en campo 'file'" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return Response.json({ error: "Archivo supera 5MB" }, { status: 400 });
  }
  try {
    const cols = preview(Buffer.from(await file.arrayBuffer()), file.name);
    const nombres = cols.map((c) => c.nombre);
    let mapeo = sugerirMapeoLocal(nombres);
    let fuente: "ia" | "local" = "local";
    try {
      const prompt = `${MAP_SYSTEM}\n\nColumnas: ${JSON.stringify(cols)}`;
      const reply = await chat(prompt, undefined, { maxLength: 8000 });
      const json = reply.text.replace(/```json?|```/g, "").trim();
      const parsed = JSON.parse(
        json.slice(json.indexOf("{"), json.lastIndexOf("}") + 1),
      ) as Record<string, string | null>;
      const validos = new Set<string>(CAMPOS_DESTINO as readonly string[]);
      const filtrado: Record<string, string | null> = {};
      for (const col of nombres) {
        const v = parsed[col];
        filtrado[col] = v && validos.has(v) ? v : null;
      }
      mapeo = filtrado;
      fuente = "ia";
    } catch (e) {
      console.error("[mapear-columnas] IA falló, usando local:", e instanceof Error ? e.message : e);
      // Fallback silencioso al mapeo local
    }
    return Response.json({ columnas: cols, mapeo, fuente });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error interno";
    return Response.json({ error: message }, { status: 400 });
  }
}
