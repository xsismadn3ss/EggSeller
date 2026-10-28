import { getSession } from "../neo4j";
import type { Sugerencia } from "./types";

export async function getEstacionalidad(puntoElegido?: string): Promise<Sugerencia[]> {
  const session = getSession();
  try {
    const result = await session.run(
      `MATCH (v:Venta)-[:INCLUYE_PRODUCTO]->(p:Producto)
       WHERE v.fecha IS NOT NULL
        OPTIONAL MATCH (pt:PuntoExpress)-[:REGISTRO]->(v)
        WITH p.nombre AS producto, coalesce(pt.codigo, 'general') AS punto, v.fecha.year AS anio, v.fecha.month AS mes, sum(v.cantidad) AS kg
        WHERE $punto IS NULL OR punto = $punto
        RETURN producto, punto, mes, avg(kg) AS promedio ORDER BY producto, punto, mes`,
      { punto: puntoElegido ?? null },
    );
    const meses = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
    const grouped = new Map<string, { mes: number; kg: number }[]>();
    for (const r of result.records) {
      const producto = `${String(r.get("producto"))}\u0000${String(r.get("punto"))}`;
      const group = grouped.get(producto) ?? [];
      group.push({ mes: Number(r.get("mes")), kg: Number(r.get("promedio")) });
      grouped.set(producto, group);
    }
    const suggestions: Sugerencia[] = [];
    for (const [clave, values] of grouped) {
      const [producto] = clave.split("\u0000");
      const general = values.reduce((sum, v) => sum + v.kg, 0) / values.length;
      for (const value of values) if (value.kg > general * 1.3) {
        const nombreMes = meses[value.mes - 1] ?? `mes ${value.mes}`;
        suggestions.push({ tipo: "estacional", severidad: "media", producto, cantidadKg: Math.round(value.kg * 100) / 100,
          motivo: `${nombreMes}: promedio histórico ${value.kg.toFixed(2)} kg, supera en más de 30% el promedio mensual (${general.toFixed(2)} kg).`,
          accion: `Preparar disponibilidad antes de ${nombreMes}.`, confianza: "estimada" });
      }
    }
    return suggestions;
  } finally { await session.close(); }
}
