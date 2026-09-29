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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CAMPOS_DESTINO } from "@/lib/validations";

type Tipo = "csv" | "excel";

interface UploadResult {
  total: number;
  insertadas: number;
  errores: { fila: number; error: string }[];
}

interface Analisis {
  columnas: { nombre: string; muestras: unknown[] }[];
  mapeo: Record<string, string | null>;
  fuente: "ia" | "local";
}

function Resultado({ result }: { result: UploadResult }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Resultado</CardTitle>
        <CardDescription>
          {result.insertadas}/{result.total} ventas guardadas.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {result.errores.length === 0 ? (
          <p className="text-sm text-green-700">Carga completa sin errores.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fila</TableHead>
                <TableHead>Error</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.errores.slice(0, 10).map((e) => (
                <TableRow key={e.fila}>
                  <TableCell>{e.fila}</TableCell>
                  <TableCell>{e.error}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        {result.errores.length > 10 && (
          <p className="mt-2 text-xs text-muted-foreground">
            ...y {result.errores.length - 10} errores más.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function CargaDirecta() {
  const [tipo, setTipo] = useState<Tipo>("csv");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);
    if (!file) {
      setError("Selecciona un archivo");
      return;
    }
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/upload-${tipo}`, {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error al subir");
      setResult(data as UploadResult);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Carga directa</CardTitle>
          <CardDescription>
            Formato clásico: Fecha, Cliente, Zona_Geografica,
            Canal_Distribucion, Canal_Venta, Producto, Categoria,
            Cantidad_kg_unid, Precio_Unitario_USD, Monto_Venta_USD. El formato
            2024-2025 (Punto, Región, Unidades...) también se detecta solo.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <div className="flex gap-2">
              <Button
                type="button"
                variant={tipo === "csv" ? "default" : "outline"}
                onClick={() => setTipo("csv")}
              >
                CSV
              </Button>
              <Button
                type="button"
                variant={tipo === "excel" ? "default" : "outline"}
                onClick={() => setTipo("excel")}
              >
                Excel
              </Button>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="file">
                Archivo {tipo === "csv" ? ".csv" : ".xls / .xlsx"} (máx 5MB,
                5000 filas)
              </Label>
              <Input
                id="file"
                type="file"
                accept={tipo === "csv" ? ".csv" : ".xls,.xlsx"}
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </div>
            {loading && <Progress value={50} />}
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button type="submit" disabled={loading || !file}>
              {loading ? "Subiendo..." : "Subir a Neo4j"}
            </Button>
          </form>
        </CardContent>
      </Card>
      {result && <Resultado result={result} />}
    </div>
  );
}

function Wizard() {
  const [file, setFile] = useState<File | null>(null);
  const [analisis, setAnalisis] = useState<Analisis | null>(null);
  const [mapeo, setMapeo] = useState<Record<string, string | null>>({});
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function analizar() {
    if (!file) {
      setError("Selecciona un archivo");
      return;
    }
    setError(null);
    setAnalisis(null);
    setResult(null);
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/mapear-columnas", {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error al analizar");
      setAnalisis(data as Analisis);
      setMapeo((data as Analisis).mapeo);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  async function cargar() {
    if (!file) return;
    setError(null);
    setResult(null);
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("mapping", JSON.stringify(mapeo));
      const res = await fetch("/api/upload-mapeado", {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error al subir");
      setResult(data as UploadResult);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Paso 1: analiza con IA</CardTitle>
          <CardDescription>
            Sube cualquier Excel o CSV. Big Pickle sugiere a qué campo va cada
            columna; tú confirmas antes de cargar.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="wfile">Archivo .csv / .xls / .xlsx (máx 5MB)</Label>
            <Input
              id="wfile"
              type="file"
              accept=".csv,.xls,.xlsx"
              onChange={(e) => {
                setFile(e.target.files?.[0] ?? null);
                setAnalisis(null);
                setResult(null);
              }}
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button onClick={analizar} disabled={loading || !file}>
            {loading ? "Analizando…" : "Analizar columnas con IA"}
          </Button>
        </CardContent>
      </Card>

      {analisis && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Paso 2: confirma el mapeo
              <Badge variant={analisis.fuente === "ia" ? "default" : "secondary"}>
                {analisis.fuente === "ia" ? "Sugerido por IA" : "Sugerido local"}
              </Badge>
            </CardTitle>
            <CardDescription>
              Ajusta cualquier columna antes de cargar.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Columna</TableHead>
                  <TableHead>Muestra</TableHead>
                  <TableHead>Campo destino</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {analisis.columnas.map((c) => (
                  <TableRow key={c.nombre}>
                    <TableCell className="font-medium">{c.nombre}</TableCell>
                    <TableCell className="max-w-40 truncate text-xs text-muted-foreground">
                      {c.muestras.map((m) => String(m ?? "")).join(" · ")}
                    </TableCell>
                    <TableCell>
                      <Select
                        value={mapeo[c.nombre] ?? "ignorar"}
                        onValueChange={(v) =>
                          setMapeo((prev) => ({
                            ...prev,
                            [c.nombre]: v === "ignorar" ? null : v,
                          }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ignorar">Ignorar</SelectItem>
                          {(CAMPOS_DESTINO as readonly string[]).map((d) => (
                            <SelectItem key={d} value={d}>
                              {d}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Button onClick={cargar} disabled={loading}>
              {loading ? "Cargando…" : "Paso 3: cargar con este mapeo"}
            </Button>
          </CardContent>
        </Card>
      )}

      {result && <Resultado result={result} />}
    </div>
  );
}

export default function SubirPage() {
  const [modo, setModo] = useState<"directa" | "wizard">("directa");
  return (
    <div className="mx-auto flex min-h-[calc(100svh-3.5rem)] max-w-2xl flex-col gap-4 p-6">
      <div className="flex gap-2">
        <Button
          variant={modo === "directa" ? "default" : "outline"}
          onClick={() => setModo("directa")}
        >
          Carga directa
        </Button>
        <Button
          variant={modo === "wizard" ? "default" : "outline"}
          onClick={() => setModo("wizard")}
        >
          Wizard con IA
        </Button>
      </div>
      {modo === "directa" ? <CargaDirecta /> : <Wizard />}
    </div>
  );
}
