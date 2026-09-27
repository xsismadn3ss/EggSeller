export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { getFiltros } from "@/lib/dashboard";

export async function GET() {
  try {
    return Response.json(await getFiltros());
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error interno";
    const status = message.includes("Falta variable de entorno") ? 503 : 400;
    return Response.json({ error: message }, { status });
  }
}
