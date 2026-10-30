"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { ChatMarkdown } from "@/components/chat-markdown";
import type { Sugerencia } from "@/lib/sugerencias/types";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const PERIODOS = [
  { label: "Últimos 30 días", desde: "2026-09-29", hasta: "2026-10-28" },
  { label: "Últimos 90 días", desde: "2026-07-30", hasta: "2026-10-28" },
  { label: "Últimos 6 meses", desde: "2026-04-28", hasta: "2026-10-28" },
  { label: "Último año", desde: "2025-10-28", hasta: "2026-10-28" },
  { label: "Todo 2023", desde: "2023-01-01", hasta: "2023-12-31" },
  { label: "Todo 2024", desde: "2024-01-01", hasta: "2024-12-31" },
  { label: "Todo 2025", desde: "2025-01-01", hasta: "2025-12-31" },
  { label: "2026 hasta hoy", desde: "2026-01-01", hasta: "2026-10-28" },
  { label: "Todo el historial (2023-hoy)", desde: "2023-01-01", hasta: "2026-10-28" },
];

const TIPOS_SUGERENCIA = [
  { value: "quiebre", label: "Riesgo de quiebre" },
  { value: "estacional", label: "Demanda estacional" },
  { value: "sustitutos", label: "Sustitutos" },
  { value: "reporte", label: "Reporte de pedido con IA" },
] as const;

export default function SugerenciasPage() {
  const [periodo, setPeriodo] = useState(PERIODOS[0].label);
  const [punto, setPunto] = useState("todos");
  const [puntos, setPuntos] = useState<string[]>([]);
  const [errorPuntos, setErrorPuntos] = useState(false);
  const [loading, setLoading] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [duracion, setDuracion] = useState<number | null>(null);
  const [reporte, setReporte] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sugerencias, setSugerencias] = useState<Record<string, Sugerencia[]>>({});
  const [tiposSeleccionados, setTiposSeleccionados] = useState<string[]>([]);
  const [explicaciones, setExplicaciones] = useState<Record<string, string>>({});
  const [explicacionesLoading, setExplicacionesLoading] = useState<Record<string, boolean>>({});
  const [explicacionesError, setExplicacionesError] = useState<Record<string, string>>({});
  const [detallesAbiertos, setDetallesAbiertos] = useState<Record<string, boolean>>({});
  const [explicacionesAbiertas, setExplicacionesAbiertas] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let activo = true;
    fetch("/api/filtros")
      .then(async (res) => {
        if (!res.ok) throw new Error("No se pudieron cargar las sucursales.");
        return res.json();
      })
      .then((data: { puntos?: unknown }) => {
        if (!activo) return;
        setPuntos(Array.isArray(data.puntos) ? data.puntos.filter((p): p is string => typeof p === "string") : []);
      })
      .catch(() => { if (activo) setErrorPuntos(true); });
    return () => { activo = false; };
  }, []);

  async function explicar(tipo: string, rows: Sugerencia[], textoReporte?: string) {
    setExplicacionesLoading((actual) => ({ ...actual, [tipo]: true }));
    setExplicacionesError((actual) => ({ ...actual, [tipo]: "" }));
    setExplicaciones((actual) => ({ ...actual, [tipo]: "" }));
    try {
      const selectedPeriod = PERIODOS.find((item) => item.label === periodo) ?? PERIODOS[0];
      const res = await fetch("/api/sugerencias/explicar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipo,
          sucursal: punto !== "todos" ? punto : undefined,
          periodo: { desde: selectedPeriod.desde, hasta: selectedPeriod.hasta },
          items: textoReporte === undefined ? rows : undefined,
          textoReporte,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "No se pudo generar la explicación.");
      setExplicaciones((actual) => ({ ...actual, [tipo]: data.text as string }));
    } catch (e) {
      setExplicacionesError((actual) => ({ ...actual, [tipo]: e instanceof Error ? e.message : String(e) }));
    } finally {
      setExplicacionesLoading((actual) => ({ ...actual, [tipo]: false }));
    }
  }

  async function generar() {
    if (tiposSeleccionados.length === 0) return;
    const p = PERIODOS.find((x) => x.label === periodo) ?? PERIODOS[0];
    setLoading(true);
    setError(null);
    setReporte(null);
    setSugerencias({});
    setExplicaciones({});
    setExplicacionesError({});
    setDuracion(null);
    const t0 = Date.now();
    setElapsed(0);
    const timer = setInterval(
      () => setElapsed(Math.round((Date.now() - t0) / 1000)),
      500,
    );
    try {
      const deterministas = tiposSeleccionados.filter((tipo) => tipo !== "reporte");
      const [resultados, reporteGenerado] = await Promise.all([
        Promise.all(deterministas.map(async (tipo) => {
          const res = await fetch(`/api/sugerencias?tipo=${tipo}&desde=${p.desde}&hasta=${p.hasta}&punto=${encodeURIComponent(punto)}`);
          const data = await res.json();
          if (!res.ok) throw new Error(data.error ?? "No se pudieron cargar las sugerencias.");
          return [tipo, data[tipo] ?? []] as const;
        })),
        tiposSeleccionados.includes("reporte")
          ? (async () => {
              const res = await fetch("/api/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  message: `Llama primero a resumen_cargamento para el periodo del ${p.desde} al ${p.hasta} y con esos datos sugiere el próximo cargamento: por producto indica cantidad aproximada en kg y justificación breve usando la tendencia. Responde en español, máximo 400 palabras: primero una tabla "Producto | Cantidad sugerida (kg) | Por qué" y luego 3 recomendaciones generales.`,
                }),
              });
              const data = await res.json();
              if (!res.ok) throw new Error(data.error ?? "No se pudo generar el reporte.");
              return data.text as string;
            })()
          : Promise.resolve(null),
      ]);
      setSugerencias(Object.fromEntries(resultados));
      setReporte(reporteGenerado);
      if (reporteGenerado) setDuracion(Math.round((Date.now() - t0) / 1000));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      clearInterval(timer);
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4 p-6">
      <Card>
        <CardHeader>
          <CardTitle>Sugerencias de pedidos</CardTitle>
          <CardDescription>
            Big Pickle analiza los hábitos de compra en Neo4j y sugiere el
            cargamento
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-6">
            <div className="grid max-w-2xl grid-cols-1 gap-5 md:grid-cols-2">
              <div className="flex flex-col gap-2">
              <Label htmlFor="periodo-sugerencias">Periodo a analizar</Label>
              <Select
                value={periodo}
                onValueChange={(v) => {
                  if (v) {
                    setPeriodo(v);
                    setSugerencias({});
                    setExplicaciones({});
                    setExplicacionesError({});
                    setReporte(null);
                    setError(null);
                  }
                }}
              >
                <SelectTrigger id="periodo-sugerencias" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PERIODOS.map((p) => (
                    <SelectItem key={p.label} value={p.label}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              </div>
              <div className="flex flex-col gap-2">
              <Label htmlFor="punto-sugerencias">Sucursal</Label>
              <Select value={punto} onValueChange={(v) => {
                if (v) {
                  setPunto(v);
                  setSugerencias({}); setExplicaciones({}); setExplicacionesError({}); setReporte(null); setError(null);
                }
              }}>
                <SelectTrigger id="punto-sugerencias" className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todas las sucursales</SelectItem>
                  {puntos.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
                </SelectContent>
              </Select>
              {errorPuntos && <p className="text-xs text-muted-foreground">No se pudo cargar la lista de sucursales.</p>}
              </div>
            </div>
            <fieldset className="min-w-0">
              <legend className="mb-3 text-sm font-medium">¿Qué quieres generar?</legend>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {TIPOS_SUGERENCIA.map((tipo) => {
                  const seleccionado = tiposSeleccionados.includes(tipo.value);
                  return (
                    <label
                      key={tipo.value}
                      className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm transition-colors hover:border-primary ${seleccionado ? "border-primary bg-accent text-accent-foreground" : "bg-muted/30"}`}
                    >
                      <input
                        type="checkbox"
                        className="size-4 shrink-0 accent-primary"
                        checked={seleccionado}
                        onChange={(event) => {
                          setTiposSeleccionados((actuales) => event.target.checked
                            ? [...actuales, tipo.value]
                            : actuales.filter((actual) => actual !== tipo.value));
                          setSugerencias({});
                          setExplicaciones({});
                          setExplicacionesError({});
                          setReporte(null);
                          setError(null);
                        }}
                      />
                      {tipo.label}
                    </label>
                  );
                })}
              </div>
            </fieldset>
          </div>
          <div className="mt-6 flex flex-col-reverse items-stretch gap-3 border-t pt-5 sm:flex-row sm:items-center">
            <span className="mr-auto text-center text-sm text-muted-foreground sm:text-left">
              {tiposSeleccionados.length === 0
                ? "Ningún tipo seleccionado"
                : `${tiposSeleccionados.length} ${tiposSeleccionados.length === 1 ? "tipo seleccionado" : "tipos seleccionados"}`}
            </span>
            <Button onClick={generar} disabled={loading || tiposSeleccionados.length === 0}>
              {loading ? <><Spinner /> Generando… ({elapsed}s)</> : "Generar"}
            </Button>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </CardContent>
      </Card>

      <p className="mx-1 text-sm leading-relaxed text-muted-foreground">
        Riesgo de quiebre detecta productos que podrían agotarse; demanda estacional muestra cambios por temporada; sustitutos propone alternativas; el reporte con IA recomienda el próximo pedido.
      </p>

      {!loading && !reporte && Object.keys(sugerencias).length === 0 && !error && (
        <p className="text-sm text-muted-foreground">Elige un periodo y uno o más tipos: riesgo de quiebre detecta productos que podrían agotarse; demanda estacional muestra cambios por temporada; sustitutos propone alternativas; el reporte con IA recomienda el próximo pedido.</p>
      )}
      {Object.keys(sugerencias).length > 0 && TIPOS_SUGERENCIA.filter(({ value }) => value !== "reporte" && tiposSeleccionados.includes(value)).map(({ value: tipo }) => {
        const titulos: Record<string, string> = { quiebre: "Riesgo de quiebre", estacional: "Demanda estacional", sustitutos: "Sustitutos" };
        const rows = sugerencias[tipo] ?? [];
        const abierto = detallesAbiertos[tipo] ?? rows.length <= 10;
        const resumen = tipo === "quiebre"
          ? `${rows.filter((row) => row.severidad === "alta" || row.severidad === "critica").length} críticas, pedido total ${rows.reduce((total, row) => total + (row.cantidadKg ?? 0), 0)} kg`
          : `${rows.length} ${rows.length === 1 ? "item" : "items"}`;
        return <Card key={tipo}>
          <button type="button" className="flex w-full items-center justify-between gap-4 rounded-xl p-6 text-left hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-expanded={abierto} aria-label={`${abierto ? "Contraer" : "Expandir"} ${titulos[tipo]}`} aria-controls={`resultado-${tipo}`} onClick={() => setDetallesAbiertos((actual) => ({ ...actual, [tipo]: !abierto }))}>
            <span className="min-w-0">
              <span className="block text-lg font-semibold">{titulos[tipo]}</span>
              <span className="block text-sm text-muted-foreground">Sugerencias deterministas basadas en ventas y campos registrados.</span>
              {!abierto && <span className="mt-2 block text-sm font-medium">{resumen}</span>}
            </span>
            <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-full border text-foreground">{abierto ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}</span>
          </button>
          <CardContent>
            <div id={`resultado-${tipo}`} className={`grid transition-[grid-template-rows] duration-300 motion-reduce:transition-none ${abierto ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
            <div className="min-h-0 overflow-hidden">
            <div className="overflow-x-auto">
            {rows.length ? <table className="w-full text-left text-sm">
                <thead><tr className="border-b"><th className="p-2">Producto</th>{tipo === "quiebre" && punto === "todos" && <th className="p-2">Punto</th>}<th className="p-2">{tipo === "sustitutos" ? "Stock (kg)" : "Cantidad sugerida"}</th><th className="p-2">Motivo</th><th className="p-2">Severidad</th></tr></thead>
               <tbody>{rows.map((row, i) => <tr className="border-b last:border-0" key={`${row.producto}-${i}`}>
                    <td className="p-2">{row.producto}</td>{tipo === "quiebre" && punto === "todos" && <td className="p-2">{row.punto ?? "—"}</td>}<td className="p-2">{row.cantidadKg === undefined ? "—" : tipo === "quiebre" && row.cantidadKg === 0 ? "Sin pedido necesario" : `${row.cantidadKg} kg`}</td>
                <td className="p-2">{row.motivo} {row.confianza === "estimada" && <span className="text-muted-foreground">(estimada)</span>}</td><td className="p-2 capitalize">{row.severidad}</td>
              </tr>)}</tbody>
             </table> : <p className="text-sm text-muted-foreground">Sin sugerencias para los datos disponibles.</p>}
             </div>
            <div className="mt-4 flex flex-col gap-3">
              <Button onClick={() => explicar(tipo, rows)} disabled={explicacionesLoading[tipo]}>
                {explicacionesLoading[tipo] ? <><Spinner /> Consultando…</> : "Preguntar con IA"}
              </Button>
              {explicacionesError[tipo] && <p className="text-sm text-red-600">{explicacionesError[tipo]}</p>}
              {explicaciones[tipo] && (() => {
                const analisisAbierto = explicacionesAbiertas[tipo] ?? explicaciones[tipo].length <= 1200;
                const tipoLabel = TIPOS_SUGERENCIA.find((item) => item.value === tipo)?.label ?? tipo;
                return <Card>
                  <button type="button" className="flex w-full items-center justify-between gap-4 rounded-xl p-6 text-left hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-expanded={analisisAbierto} aria-label={`${analisisAbierto ? "Contraer" : "Expandir"} análisis con IA`} aria-controls={`analisis-${tipo}`} onClick={() => setExplicacionesAbiertas((actual) => ({ ...actual, [tipo]: !analisisAbierto }))}>
                    <span className="min-w-0">
                      <span className="block text-lg font-semibold">Análisis con IA</span>
                      <span className="block text-sm text-muted-foreground">Análisis de {tipoLabel}</span>
                      {!analisisAbierto && <span className="mt-2 block text-sm font-medium">Análisis de {tipoLabel} · {explicaciones[tipo].length} caracteres</span>}
                    </span>
                    <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-full border text-foreground">{analisisAbierto ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}</span>
                  </button>
                  <CardContent>
                    <div id={`analisis-${tipo}`} className={`grid transition-[grid-template-rows] duration-300 motion-reduce:transition-none ${analisisAbierto ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
                      <div className="min-h-0 overflow-hidden"><ChatMarkdown text={explicaciones[tipo]} /></div>
                    </div>
                  </CardContent>
                </Card>;
              })()}
            </div>
            </div>
            </div>
          </CardContent>
        </Card>;
      })}

      {loading && tiposSeleccionados.includes("reporte") && (
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-56" />
            <Skeleton className="h-4 w-32" />
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Spinner /> Analizando hábitos de compra en Neo4j…
            </div>
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-11/12" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/5" />
          </CardContent>
        </Card>
      )}

      {reporte && (
        <Card>
          <button type="button" className="flex w-full items-center justify-between gap-4 rounded-xl p-6 text-left hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-expanded={detallesAbiertos.reporte ?? reporte.length <= 1200} aria-label={`${(detallesAbiertos.reporte ?? reporte.length <= 1200) ? "Contraer" : "Expandir"} reporte`} aria-controls="resultado-reporte" onClick={() => setDetallesAbiertos((actual) => ({ ...actual, reporte: !(actual.reporte ?? reporte.length <= 1200) }))}>
            <span className="min-w-0">
              <span className="block text-lg font-semibold">Reporte de pedido sugerido</span>
              <span className="block text-sm text-muted-foreground">{periodo} · Reporte generado con IA{duracion !== null && ` · generado en ${duracion}s`}</span>
              {(detallesAbiertos.reporte ?? reporte.length <= 1200) === false && <span className="mt-2 block text-sm font-medium">{reporte.slice(0, 160)}{reporte.length > 160 ? "…" : ""}</span>}
            </span>
            <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-full border text-foreground">{(detallesAbiertos.reporte ?? reporte.length <= 1200) ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}</span>
          </button>
          <CardContent>
            <div id="resultado-reporte" className={`grid transition-[grid-template-rows] duration-300 motion-reduce:transition-none ${(detallesAbiertos.reporte ?? reporte.length <= 1200) ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
              <div className="min-h-0 overflow-hidden"><ChatMarkdown text={reporte} /></div>
            </div>
            <div className="mt-4 flex flex-col gap-3">
              <Button onClick={() => explicar("reporte", [], reporte)} disabled={explicacionesLoading.reporte}>
                {explicacionesLoading.reporte ? <><Spinner /> Consultando…</> : "Preguntar con IA"}
              </Button>
              {explicacionesError.reporte && <p className="text-sm text-red-600">{explicacionesError.reporte}</p>}
              {explicaciones.reporte && (() => {
                const analisisAbierto = explicacionesAbiertas.reporte ?? explicaciones.reporte.length <= 1200;
                return <Card>
                  <button type="button" className="flex w-full items-center justify-between gap-4 rounded-xl p-6 text-left hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-expanded={analisisAbierto} aria-label={`${analisisAbierto ? "Contraer" : "Expandir"} análisis con IA`} aria-controls="analisis-reporte" onClick={() => setExplicacionesAbiertas((actual) => ({ ...actual, reporte: !analisisAbierto }))}>
                    <span className="min-w-0">
                      <span className="block text-lg font-semibold">Análisis con IA</span>
                      <span className="block text-sm text-muted-foreground">Análisis de Reporte de pedido con IA</span>
                      {!analisisAbierto && <span className="mt-2 block text-sm font-medium">Análisis de reporte · {explicaciones.reporte.length} caracteres</span>}
                    </span>
                    <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-full border text-foreground">{analisisAbierto ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}</span>
                  </button>
                  <CardContent>
                    <div id="analisis-reporte" className={`grid transition-[grid-template-rows] duration-300 motion-reduce:transition-none ${analisisAbierto ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
                      <div className="min-h-0 overflow-hidden"><ChatMarkdown text={explicaciones.reporte} /></div>
                    </div>
                  </CardContent>
                </Card>;
              })()}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
