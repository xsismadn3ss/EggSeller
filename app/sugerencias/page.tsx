"use client";

import { useState } from "react";
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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const PERIODOS = [
  { label: "Últimos 30 días", desde: "2025-12-02", hasta: "2025-12-31" },
  { label: "Últimos 60 días", desde: "2025-11-02", hasta: "2025-12-31" },
  { label: "Últimos 90 días", desde: "2025-10-03", hasta: "2025-12-31" },
  { label: "Todo 2025", desde: "2025-01-01", hasta: "2025-12-31" },
];

export default function SugerenciasPage() {
  const [periodo, setPeriodo] = useState(PERIODOS[0].label);
  const [loading, setLoading] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [duracion, setDuracion] = useState<number | null>(null);
  const [reporte, setReporte] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function generar() {
    const p = PERIODOS.find((x) => x.label === periodo) ?? {
      desde: "2025-12-02",
      hasta: "2025-12-31",
    };
    setLoading(true);
    setError(null);
    setReporte(null);
    setDuracion(null);
    const t0 = Date.now();
    setElapsed(0);
    const timer = setInterval(
      () => setElapsed(Math.round((Date.now() - t0) / 1000)),
      500,
    );
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: `Llama primero a resumen_cargamento para el periodo del ${p.desde} al ${p.hasta} y con esos datos sugiere el próximo cargamento: por producto indica cantidad aproximada en kg y justificación breve usando la tendencia. Responde en español, máximo 400 palabras: primero una tabla "Producto | Cantidad sugerida (kg) | Por qué" y luego 3 recomendaciones generales.`,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error al generar");
      setReporte(data.text);
      setDuracion(Math.round((Date.now() - t0) / 1000));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      clearInterval(timer);
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 p-6">
      <Card>
        <CardHeader>
          <CardTitle>Sugerencias de pedidos</CardTitle>
          <CardDescription>
            Big Pickle analiza los hábitos de compra en Neo4j y sugiere el
            cargamento
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex items-end gap-2">
            <div className="flex flex-col gap-1">
              <Label>Periodo a analizar</Label>
              <Select
                value={periodo}
                onValueChange={(v) => {
                  if (v) setPeriodo(v);
                }}
              >
                <SelectTrigger className="w-48">
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
            <Button onClick={generar} disabled={loading}>
              {loading ? (
                <>
                  <Spinner /> Generando… ({elapsed}s)
                </>
              ) : (
                "Generar sugerencia"
              )}
            </Button>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </CardContent>
      </Card>

      {loading && (
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
          <CardHeader>
            <CardTitle>Reporte de pedido sugerido</CardTitle>
            <CardDescription>
              {periodo}
              {duracion !== null && ` · generado en ${duracion}s`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChatMarkdown text={reporte} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
