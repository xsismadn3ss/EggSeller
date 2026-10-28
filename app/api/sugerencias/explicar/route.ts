import { chat } from "@/lib/opencode";
import type { Sugerencia } from "@/lib/sugerencias/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TIPOS = ["quiebre", "estacional", "sustitutos", "reporte"] as const;
const ORDEN: Record<Sugerencia["severidad"], number> = {
  baja: 0,
  media: 1,
  alta: 2,
  critica: 3,
};
const MAX_LENGTH = 12000;

interface RequestBody {
  tipo?: unknown;
  sucursal?: unknown;
  periodo?: unknown;
  items?: unknown;
  textoReporte?: unknown;
}

function isSugerencia(value: unknown): value is Sugerencia {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<Sugerencia>;
  return typeof item.producto === "string" &&
    typeof item.motivo === "string" && item.motivo.length <= 500 &&
    typeof item.severidad === "string" && item.severidad in ORDEN &&
    (item.punto === undefined || typeof item.punto === "string") &&
    (item.cantidadKg === undefined || typeof item.cantidadKg === "number") &&
    (item.precioPromedio === undefined || typeof item.precioPromedio === "number") &&
    (item.fechaCorte === undefined || typeof item.fechaCorte === "string");
}

export async function POST(request: Request) {
  let body: RequestBody;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "JSON inválido" }, { status: 400 });
  }
  if (!TIPOS.includes(body.tipo as (typeof TIPOS)[number])) {
    return Response.json({ error: "tipo inválido" }, { status: 400 });
  }
  const usaTextoReporte = body.tipo === "reporte" && body.textoReporte !== undefined;
  if (usaTextoReporte && (typeof body.textoReporte !== "string" || body.textoReporte.length > 6000)) {
    return Response.json({ error: "'textoReporte' inválido (máximo 6000 caracteres)" }, { status: 400 });
  }
  if (!usaTextoReporte && (!Array.isArray(body.items) || body.items.length === 0 || body.items.length > 200 || !body.items.every(isSugerencia))) {
    return Response.json({ error: "items inválidos (se requiere entre 1 y 200 sugerencias válidas)" }, { status: 400 });
  }
  if (body.sucursal !== undefined && typeof body.sucursal !== "string") {
    return Response.json({ error: "'sucursal' inválida" }, { status: 400 });
  }
  if (body.periodo !== undefined && (!body.periodo || typeof body.periodo !== "object" ||
    typeof (body.periodo as { desde?: unknown }).desde !== "string" ||
    typeof (body.periodo as { hasta?: unknown }).hasta !== "string")) {
    return Response.json({ error: "'periodo' inválido" }, { status: 400 });
  }

  if (usaTextoReporte) {
    const message = `Instrucciones: usa solo los datos del reporte siguiente, sin usar herramientas ni inventar información.\n\n${body.textoReporte}\n\nAmplía con las 3 acciones más prioritarias y 1 riesgo a vigilar, español, máx 150 palabras.`;
    try {
      const reply = await chat(message.slice(0, MAX_LENGTH), undefined, { maxLength: MAX_LENGTH });
      return Response.json({ text: reply.text });
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

  const items = body.items as Sugerencia[];
  const cabecera = [
    `Tipo: ${body.tipo}`,
    typeof body.sucursal === "string" ? `Sucursal: ${body.sucursal}` : "",
    body.periodo ? `Periodo: ${(body.periodo as { desde: string }).desde} a ${(body.periodo as { hasta: string }).hasta}` : "",
  ].filter(Boolean).join(" | ");
  const panorama = body.tipo === "quiebre"
    ? `Panorama global: ${items.filter((item) => item.severidad === "critica").length} items en crítica, ${items.filter((item) => item.severidad === "alta").length} en alta, cantidad total ${items.reduce((sum, item) => sum + (item.cantidadKg ?? 0), 0)} kg en ${new Set(items.flatMap((item) => item.punto ? [item.punto] : [])).size} sucursales.`
    : "";
  const lines = items.map((item, index) => ({
    index,
    severidad: item.severidad,
    text: `Producto: ${item.producto} | Punto: ${item.punto ?? "—"} | Severidad: ${item.severidad} | Cantidad: ${item.cantidadKg ?? "—"} kg | Motivo: ${item.motivo.slice(0, 120)}${item.precioPromedio !== undefined ? ` | Precio: ${item.precioPromedio}` : ""}${item.fechaCorte ? ` | Fecha: ${item.fechaCorte}` : ""}`,
  }));
  const instructions = "Instrucciones: explica brevemente qué muestran estos datos y da 2-3 recomendaciones concretas. Usa solo estos datos, no uses herramientas, no inventes información y no menciones limitaciones de costos o márgenes. Responde en español, máximo 200 palabras.";
  const prefix = [cabecera, panorama].filter(Boolean).join("\n");
  const fixed = `${prefix}\n${instructions}\n`;
  let selected = [...lines].sort((a, b) => ORDEN[b.severidad] - ORDEN[a.severidad] || a.index - b.index);
  let message = `${fixed}${selected.map((item) => item.text).join("\n")}`;
  while (message.length > MAX_LENGTH && selected.length > 1) {
    selected.pop();
    message = `${fixed}${selected.map((item) => item.text).join("\n")}`;
  }
  if (message.length > MAX_LENGTH) message = message.slice(0, MAX_LENGTH);

  try {
    const reply = await chat(message, undefined, { maxLength: MAX_LENGTH });
    return Response.json({ text: reply.text });
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
