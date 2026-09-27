export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { chat } from "@/lib/opencode";

export async function POST(request: Request) {
  let body: { message?: unknown; sessionId?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "JSON inválido" }, { status: 400 });
  }
  if (typeof body.message !== "string" || !body.message.trim()) {
    return Response.json({ error: "Falta 'message'" }, { status: 400 });
  }
  if (body.message.length > 2000) {
    return Response.json(
      { error: "Mensaje supera 2000 caracteres" },
      { status: 400 },
    );
  }
  if (
    body.sessionId !== undefined &&
    body.sessionId !== null &&
    typeof body.sessionId !== "string"
  ) {
    return Response.json({ error: "'sessionId' inválido" }, { status: 400 });
  }
  try {
    const reply = await chat(
      body.message.trim(),
      typeof body.sessionId === "string" ? body.sessionId : undefined,
    );
    return Response.json(reply);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error interno";
    const status = message.includes("Falta variable de entorno")
      ? 503
      : message.includes("supera") || message.includes("Falta 'message'")
        ? 400
        : 502;
    return Response.json({ error: message }, { status });
  }
}
