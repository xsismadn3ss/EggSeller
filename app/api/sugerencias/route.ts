import { NextRequest, NextResponse } from "next/server";
import { getRiesgoQuiebre } from "@/lib/sugerencias/quiebre";
import { getEstacionalidad } from "@/lib/sugerencias/estacional";
import { getSustitutos } from "@/lib/sugerencias/sustitutos";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const tipo = params.get("tipo") ?? "todos";
  const punto = params.get("punto");
  const puntoElegido = punto && punto !== "todos" ? punto : undefined;
  if (!["quiebre", "estacional", "sustitutos", "todos"].includes(tipo)) {
    return NextResponse.json({ error: "tipo inválido" }, { status: 400 });
  }
  try {
    const data: Record<string, unknown> = {};
    if (tipo === "todos" || tipo === "quiebre") data.quiebre = await getRiesgoQuiebre(params.get("desde") ?? undefined, params.get("hasta") ?? undefined, puntoElegido);
    if (tipo === "todos" || tipo === "estacional") data.estacional = await getEstacionalidad(puntoElegido);
    if (tipo === "todos" || tipo === "sustitutos") data.sustitutos = await getSustitutos(params.get("producto") ?? undefined, puntoElegido);
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error consultando sugerencias" }, { status: 500 });
  }
}
