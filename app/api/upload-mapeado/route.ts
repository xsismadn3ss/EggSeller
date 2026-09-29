export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { mapRowToVentaInput } from "@/lib/validations";
import { rawCsvRows, rawExcelRows } from "@/lib/parse";
import { saveVentasBatch } from "@/lib/ventas";

const MAX_BYTES = 5 * 1024 * 1024;

/** Carga con mapeo explícito del wizard: { columnaOrigen: campoDestino | null }. */
export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get("file");
  const mappingRaw = formData.get("mapping");
  if (!(file instanceof File)) {
    return Response.json({ error: "Falta archivo en campo 'file'" }, { status: 400 });
  }
  if (typeof mappingRaw !== "string") {
    return Response.json({ error: "Falta 'mapping' JSON" }, { status: 400 });
  }
  let mapping: Record<string, string | null>;
  try {
    mapping = JSON.parse(mappingRaw) as Record<string, string | null>;
  } catch {
    return Response.json({ error: "'mapping' no es JSON válido" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return Response.json({ error: "Archivo supera 5MB" }, { status: 400 });
  }
  try {
    const esCsv = file.name.toLowerCase().endsWith(".csv");
    const raw = esCsv
      ? rawCsvRows(Buffer.from(await file.arrayBuffer()))
      : rawExcelRows(Buffer.from(await file.arrayBuffer()));
    const fuente = esCsv ? "csv" : "excel";
    // La moneda se detecta por las columnas ORIGINALES (al renombrar se
    // pierde la señal R$). Vale para todo el archivo.
    const esBRL = Object.keys(raw[0] ?? {}).some((k) =>
      /R\$|reais|brl/i.test(k),
    );
    const rows = raw.map((r) => {
      const renamed: Record<string, unknown> = {};
      for (const [origen, destino] of Object.entries(mapping)) {
        if (destino && r[origen] !== undefined) renamed[destino] = r[origen];
      }
      if (esBRL) renamed.moneda = "BRL";
      return mapRowToVentaInput(renamed, fuente);
    });
    const { insertadas, errores } = await saveVentasBatch(rows);
    return Response.json({ total: rows.length, insertadas, errores }, { status: 201 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error interno";
    const status = message.includes("Falta variable de entorno") ? 503 : 400;
    return Response.json({ error: message }, { status });
  }
}
