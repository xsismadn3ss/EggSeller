export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { parseExcelBuffer } from "@/lib/parse";
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
  if (!/\.xlsx?$/i.test(file.name)) {
    return Response.json(
      { error: "El archivo debe ser .xls o .xlsx" },
      { status: 400 },
    );
  }
  if (file.size > MAX_BYTES) {
    return Response.json({ error: "Excel supera 5MB" }, { status: 400 });
  }
  try {
    const rows = parseExcelBuffer(
      Buffer.from(await file.arrayBuffer()),
      "excel",
    );
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
