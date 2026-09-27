export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { getDashboardDataCached, parseFilters } from "@/lib/dashboard";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const sp: Record<string, string | undefined> = {};
    url.searchParams.forEach((v, k) => {
      sp[k] = v;
    });
    const data = await getDashboardDataCached(parseFilters(sp));
    return Response.json(data);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error interno";
    const status = message.includes("Falta variable de entorno") ? 503 : 400;
    return Response.json({ error: message }, { status });
  }
}
