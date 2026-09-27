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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Tipo = "csv" | "excel";

interface UploadResult {
  total: number;
  insertadas: number;
  errores: { fila: number; error: string }[];
}

export default function SubirPage() {
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
    <div className="mx-auto flex min-h-[calc(100svh-3.5rem)] max-w-2xl flex-col gap-4 p-6">
      <Card>
        <CardHeader>
          <CardTitle>Subir datos históricos</CardTitle>
          <CardDescription>
            Carga ventas en CSV o Excel. Columnas: Fecha, Cliente,
            Zona_Geografica, Canal_Distribucion, Canal_Venta, Producto,
            Categoria, Cantidad_kg_unid, Precio_Unitario_USD,
            Monto_Venta_USD.
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

      {result && (
        <Card>
          <CardHeader>
            <CardTitle>Resultado</CardTitle>
            <CardDescription>
              {result.insertadas}/{result.total} ventas guardadas.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {result.errores.length === 0 ? (
              <p className="text-sm text-green-700">
                Carga completa sin errores.
              </p>
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
      )}
    </div>
  );
}
