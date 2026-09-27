export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { saveVenta } from "@/lib/ventas";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "JSON inválido" }, { status: 400 });
  }
  try {
    const { ventaId, montoCalculado } = await saveVenta({
      ...(body as Record<string, unknown>),
      fuente: "api",
    });
    return Response.json(
      { ventaId, montoCalculado, dedup: false },
      { status: 201 },
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error interno";
    const status =
      message.includes("Falta variable de entorno") ||
      message.includes("Failed to connect") ||
      message.includes("Could not perform discovery")
        ? 503
        : 400;
    return Response.json({ error: message }, { status });
  }
}
