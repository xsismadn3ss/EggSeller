import { parse } from "csv-parse/sync";
import * as XLSX from "xlsx";
import { mapRowToVentaInput } from "./validations";

const MAX_ROWS = 5000;

export function rawCsvRows(buffer: Buffer): Record<string, unknown>[] {
  const records = parse(buffer.toString("utf-8"), {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as Record<string, unknown>[];
  if (records.length === 0) throw new Error("CSV sin filas de datos");
  if (records.length > MAX_ROWS)
    throw new Error(`CSV excede máximo de ${MAX_ROWS} filas`);
  return records;
}

export function rawExcelRows(buffer: Buffer): Record<string, unknown>[] {
  const wb = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) throw new Error("Excel sin hojas");
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(
    wb.Sheets[sheetName],
    { defval: null },
  );
  if (rows.length === 0) throw new Error("Excel sin filas de datos");
  if (rows.length > MAX_ROWS)
    throw new Error(`Excel excede máximo de ${MAX_ROWS} filas`);
  return rows.map((r) => {
    const clean: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(r)) clean[k.trim()] = v;
    return clean;
  });
}

export function parseCsvBuffer(
  buffer: Buffer,
  fuente: "csv",
): unknown[] {
  const text = buffer.toString("utf-8");
  const records = parse(text, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as Record<string, unknown>[];
  if (records.length === 0) throw new Error("CSV sin filas de datos");
  if (records.length > MAX_ROWS)
    throw new Error(`CSV excede máximo de ${MAX_ROWS} filas`);
  return records.map((r) => mapRowToVentaInput(r, fuente));
}

export function parseExcelBuffer(
  buffer: Buffer,
  fuente: "excel",
): unknown[] {
  const wb = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) throw new Error("Excel sin hojas");
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(
    wb.Sheets[sheetName],
    { defval: null },
  );
  if (rows.length === 0) throw new Error("Excel sin filas de datos");
  if (rows.length > MAX_ROWS)
    throw new Error(`Excel excede máximo de ${MAX_ROWS} filas`);
  return rows.map((r) => {
    const clean: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(r)) clean[k.trim()] = v;
    return mapRowToVentaInput(clean, fuente);
  });
}
