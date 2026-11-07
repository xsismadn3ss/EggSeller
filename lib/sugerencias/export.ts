"use client";

import type { Sugerencia } from "./types";

export interface ExportMeta {
  tipoLabel: string;
  periodo: string;
  punto: string;
}

function sanitizeFileName(value: string): string {
  return (
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "reporte"
  );
}

function filaDatos(row: Sugerencia, conPunto: boolean): (string | number)[] {
  const cantidad =
    row.cantidadKg === undefined
      ? "—"
      : row.cantidadKg === 0 && row.tipo === "quiebre"
        ? "Sin pedido necesario"
        : `${row.cantidadKg} kg`;
  const motivo =
    row.confianza === "estimada" ? `${row.motivo} (estimada)` : row.motivo;
  const base: (string | number)[] = [row.producto];
  if (conPunto) base.push(row.punto ?? "—");
  base.push(cantidad, motivo, row.severidad, row.accion);
  return base;
}

function encabezados(tipo: string, conPunto: boolean): string[] {
  const head = ["Producto"];
  if (conPunto) head.push("Punto");
  head.push(
    tipo === "sustitutos" ? "Stock (kg)" : "Cantidad sugerida",
    "Motivo",
    "Severidad",
    "Acción sugerida",
  );
  return head;
}

/** Ancho de columnas aproximado según el contenido. */
function autoCols(aoa: (string | number)[][]): { wch: number }[] {
  const n = Math.max(...aoa.map((r) => r.length));
  const cols: { wch: number }[] = [];
  for (let c = 0; c < n; c++) {
    let max = 10;
    for (const row of aoa) {
      const len = String(row[c] ?? "").length;
      if (len > max) max = len;
    }
    cols.push({ wch: Math.min(max + 2, 60) });
  }
  return cols;
}

async function xlsx() {
  return import("xlsx");
}

export async function descargarExcelSugerencias(
  tipo: string,
  tipoLabel: string,
  rows: Sugerencia[],
  meta: Omit<ExportMeta, "tipoLabel">,
  analisisIA?: string,
): Promise<void> {
  const XLSX = await xlsx();
  const conPunto = tipo === "quiebre" && meta.punto === "todos";
  const datos: (string | number)[][] = [
    encabezados(tipo, conPunto),
    ...rows.map((row) => filaDatos(row, conPunto)),
  ];
  const wb = XLSX.utils.book_new();

  const wsDatos = XLSX.utils.aoa_to_sheet(datos);
  wsDatos["!cols"] = autoCols(datos);
  XLSX.utils.book_append_sheet(wb, wsDatos, "Datos");

  if (analisisIA?.trim()) {
    const lineas = analisisIA
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    const wsIA = XLSX.utils.aoa_to_sheet([
      ["Análisis con IA"],
      ...lineas.map((l) => [l]),
    ]);
    wsIA["!cols"] = [{ wch: 100 }];
    XLSX.utils.book_append_sheet(wb, wsIA, "Análisis IA");
  }

  const wsInfo = XLSX.utils.aoa_to_sheet([
    ["Reporte de sugerencias — EggSeller"],
    ["Tipo", tipoLabel],
    ["Periodo", meta.periodo],
    ["Sucursal", meta.punto],
    ["Generado", new Date().toLocaleString("es")],
    ["Filas", rows.length],
  ]);
  wsInfo["!cols"] = [{ wch: 28 }, { wch: 40 }];
  XLSX.utils.book_append_sheet(wb, wsInfo, "Info");

  XLSX.writeFile(
    wb,
    `sugerencias-${sanitizeFileName(tipo)}-${sanitizeFileName(meta.periodo)}.xlsx`,
  );
}

export async function descargarTodoExcel(
  tablas: { tipo: string; tipoLabel: string; rows: Sugerencia[] }[],
  meta: Omit<ExportMeta, "tipoLabel">,
): Promise<void> {
  const XLSX = await xlsx();
  const wb = XLSX.utils.book_new();
  const nombres = new Set<string>();
  for (const { tipo, tipoLabel, rows } of tablas) {
    if (rows.length === 0) continue;
    const conPunto = tipo === "quiebre" && meta.punto === "todos";
    const datos: (string | number)[][] = [
      encabezados(tipo, conPunto),
      ...rows.map((row) => filaDatos(row, conPunto)),
    ];
    const ws = XLSX.utils.aoa_to_sheet(datos);
    ws["!cols"] = autoCols(datos);
    let nombre = tipoLabel.slice(0, 28) || tipo;
    let i = 2;
    while (nombres.has(nombre)) nombre = `${tipoLabel.slice(0, 24)} ${i++}`;
    nombres.add(nombre);
    XLSX.utils.book_append_sheet(wb, ws, nombre);
  }
  const wsInfo = XLSX.utils.aoa_to_sheet([
    ["Reporte de sugerencias — EggSeller"],
    ["Periodo", meta.periodo],
    ["Sucursal", meta.punto],
    ["Generado", new Date().toLocaleString("es")],
  ]);
  wsInfo["!cols"] = [{ wch: 28 }, { wch: 40 }];
  XLSX.utils.book_append_sheet(wb, wsInfo, "Info");
  XLSX.writeFile(
    wb,
    `sugerencias-todas-${sanitizeFileName(meta.periodo)}.xlsx`,
  );
}

/** Exporta un texto Markdown (reporte IA) como hoja de líneas. */
export async function descargarTextoExcel(
  titulo: string,
  texto: string,
  meta: Omit<ExportMeta, "tipoLabel">,
): Promise<void> {
  const XLSX = await xlsx();
  const lineas = texto
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([[titulo], ...lineas.map((l) => [l])]);
  ws["!cols"] = [{ wch: 100 }];
  XLSX.utils.book_append_sheet(wb, ws, "Reporte");
  const wsInfo = XLSX.utils.aoa_to_sheet([
    ["Periodo", meta.periodo],
    ["Generado", new Date().toLocaleString("es")],
  ]);
  wsInfo["!cols"] = [{ wch: 28 }, { wch: 40 }];
  XLSX.utils.book_append_sheet(wb, wsInfo, "Info");
  XLSX.writeFile(wb, `${sanitizeFileName(titulo)}.xlsx`);
}
