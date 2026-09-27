export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { parseCsvBuffer } from "@/lib/parse";
import { saveVentasBatch } from "@/lib/ventas";

const MAX_BYTES = 5 * 1024 * 1024;

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return Response.json(
      { error: "Falta archivo en campo 'file'" },
      { status: 400 },
    );
  }
  if (!file.name.toLowerCase().endsWith(".csv")) {
    return Response.json({ error: "El archivo debe ser .csv" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return Response.json({ error: "CSV supera 5MB" }, { status: 400 });
  }
  try {
    const rows = parseCsvBuffer(Buffer.from(await file.arrayBuffer()), "csv");
    const { insertadas, errores } = await saveVentasBatch(rows);
    return Response.json(
      { total: rows.length, insertadas, errores },
      { status: 201 },
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error interno";
    const status = message.includes("Falta variable de entorno") ? 503 : 400;
    return Response.json({ error: message }, { status });
  }
}
