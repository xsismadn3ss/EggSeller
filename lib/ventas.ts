import { randomUUID } from "node:crypto";
import { getSession } from "./neo4j";
import { normalizeVenta, slugify, type VentaNormalizada } from "./validations";

const SAVE_CYPHER = `
MERGE (c:Cliente {nombre: $cliente})
  ON CREATE SET c.clienteId = $clienteId, c.createdAt = datetime()
MERGE (z:ZonaGeografica {nombre: $zonaGeografica})
MERGE (c)-[:UBICADO_EN]->(z)
MERGE (p:Producto {nombre: $producto})
  ON CREATE SET p.productoId = $productoId, p.unidad = 'kg/unid', p.createdAt = datetime()
MERGE (cat:Categoria {nombre: $categoria})
MERGE (p)-[:PERTENECE_A]->(cat)
MERGE (cd:CanalDistribucion {nombre: $canalDistribucion})
MERGE (cv:CanalVenta {nombre: $canalVenta})
CREATE (v:Venta {ventaId: $ventaId, fecha: date($fecha), cantidad: $cantidad, precioUnitario: $precioUnitario, monto: $monto, fuente: $fuente, createdAt: datetime()})
CREATE (c)-[:REALIZO]->(v)
CREATE (v)-[:INCLUYE_PRODUCTO]->(p)
CREATE (v)-[:POR_CANAL_DIST]->(cd)
CREATE (v)-[:POR_CANAL_VENTA]->(cv)
RETURN v.ventaId AS ventaId, v.monto AS monto
`;

export interface SaveResult {
  ventaId: string;
  montoCalculado: number;
}

export async function saveVenta(input: unknown): Promise<SaveResult> {
  const v: VentaNormalizada = normalizeVenta(input);
  const ventaId = randomUUID();
  const session = getSession();
  try {
    const res = await session.executeWrite((tx) =>
      tx.run(SAVE_CYPHER, {
        ...v,
        ventaId,
        clienteId: slugify(v.cliente),
        productoId: slugify(v.producto),
      }),
    );
    const record = res.records[0];
    return {
      ventaId: record.get("ventaId"),
      montoCalculado: record.get("monto"),
    };
  } finally {
    await session.close();
  }
}

export interface BatchResult {
  insertadas: number;
  errores: { fila: number; error: string }[];
}

export async function saveVentasBatch(
  rows: unknown[],
  onProgress?: (done: number, total: number) => void,
): Promise<BatchResult> {
  const errores: BatchResult["errores"] = [];
  let insertadas = 0;
  for (let i = 0; i < rows.length; i++) {
    try {
      await saveVenta(rows[i]);
      insertadas++;
    } catch (e) {
      errores.push({
        fila: i + 2, // +1 header, +1 base-1
        error: e instanceof Error ? e.message : String(e),
      });
    }
    onProgress?.(i + 1, rows.length);
  }
  return { insertadas, errores };
}
