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

/** Convierte Markdown a texto plano legible y corta líneas largas.
 *  Los `\n` incrustados sí se muestran como saltos en Excel aunque la
 *  celda no tenga "Ajustar texto" (estilo que `xlsx` no puede grabar). */
function markdownACelda(md: string, ancho = 90): { texto: string; lineas: number } {
  const normalizado = md.replace(/\r\n?/g, "\n");
  const procesadas: string[] = [];
  for (const cruda of normalizado.split("\n")) {
    let line = cruda.trim();
    // Separador de tabla GFM (| --- | --- |): no aporta nada en texto plano.
    if (line.includes("---") && /^\|?[\s:|-]+\|?$/.test(line)) continue;
    // Regla horizontal.
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line)) continue;
    // Encabezados, citas, viñetas.
    line = line.replace(/^#{1,6}\s*/, "");
    line = line.replace(/^>\s?/, "");
    if (/^\|.*\|$/.test(line)) {
      line = line
        .split("|")
        .map((c) => c.trim())
        .filter(Boolean)
        .join(" | ");
    }
    line = line.replace(/^(\d+[.)]|[-*+])\s+/, "• ");
    // Formato en línea: **negrita**, *cursiva*, `código`.
    line = line
      .replace(/(\*\*|__)(.*?)\1/g, "$2")
      .replace(/(^|\W)\*([^*\n]+)\*/g, "$1$2")
      .replace(/(^|\W)_([^_\n]+)_/g, "$1$2")
      .replace(/`([^`]*)`/g, "$1")
      .trim();
    procesadas.push(line);
  }
  const colapsado = procesadas.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  // Corte manual de líneas largas por palabras.
  const cortadas: string[] = [];
  for (const line of colapsado.split("\n")) {
    if (line.length <= ancho || !line.includes(" ")) {
      cortadas.push(line);
      continue;
    }
    let actual = "";
    for (const palabra of line.split(/\s+/)) {
      const candidato = actual ? `${actual} ${palabra}` : palabra;
      if (candidato.length > ancho && actual) {
        cortadas.push(actual);
        actual = palabra;
      } else {
        actual = candidato;
      }
    }
    if (actual) cortadas.push(actual);
  }
  return { texto: cortadas.join("\n"), lineas: cortadas.length };
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
    const { texto, lineas } = markdownACelda(analisisIA);
    const wsIA = XLSX.utils.aoa_to_sheet([["Análisis con IA"], [texto]]);
    wsIA["!cols"] = [{ wch: 100 }];
    // Altura según las líneas reales del texto convertido.
    wsIA["!rows"] = [{ hpt: 15 }, { hpt: Math.min(15 + lineas * 15, 409) }];
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

/** Exporta un texto Markdown (reporte IA) en una sola celda. */
export async function descargarTextoExcel(
  titulo: string,
  texto: string,
  meta: Omit<ExportMeta, "tipoLabel">,
): Promise<void> {
  const XLSX = await xlsx();
  const { texto: textoLimpio, lineas } = markdownACelda(texto);
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([[titulo], [textoLimpio]]);
  ws["!cols"] = [{ wch: 100 }];
  ws["!rows"] = [{ hpt: 15 }, { hpt: Math.min(15 + lineas * 15, 409) }];
  XLSX.utils.book_append_sheet(wb, ws, "Reporte");
  const wsInfo = XLSX.utils.aoa_to_sheet([
    ["Periodo", meta.periodo],
    ["Generado", new Date().toLocaleString("es")],
  ]);
  wsInfo["!cols"] = [{ wch: 28 }, { wch: 40 }];
  XLSX.utils.book_append_sheet(wb, wsInfo, "Info");
  XLSX.writeFile(wb, `${sanitizeFileName(titulo)}.xlsx`);
}
