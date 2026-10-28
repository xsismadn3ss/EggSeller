import { getSession } from "../neo4j";
import type { Sugerencia } from "./types";

export async function getSustitutos(productoAgotado?: string, puntoElegido?: string): Promise<Sugerencia[]> {
  const session = getSession();
  try {
    const result = await session.run(
      `OPTIONAL MATCH (agotado:Producto {nombre: $producto})-[:PERTENECE_A]->(cat:Categoria)
       MATCH (p:Producto)-[:PERTENECE_A]->(categoria:Categoria)
       WHERE ($producto IS NULL OR (categoria = cat AND p.nombre <> $producto))
        OPTIONAL MATCH (v:Venta)-[:INCLUYE_PRODUCTO]->(p)
        OPTIONAL MATCH (pt:PuntoExpress)-[:REGISTRO]->(v)
        WITH agotado, cat, p, categoria, v, pt
        WHERE $punto IS NULL OR pt.codigo = $punto
        WITH p.nombre AS producto, categoria.nombre AS categoria,
             CASE WHEN $punto IS NULL THEN null ELSE $punto END AS punto,
             max(v.stockDisponible) AS stock, sum(v.cantidad) AS historico,
             avg(v.precioUnitario) AS precio
        WHERE ($punto IS NULL AND ($producto IS NULL OR stock > 0 OR stock IS NULL))
           OR ($punto IS NOT NULL AND stock > 0)
        RETURN producto, categoria, punto, stock, historico, precio ORDER BY historico DESC`,
       { producto: productoAgotado ?? null, punto: puntoElegido ?? null },
    );
     let rows = result.records.map((r) => ({ producto: String(r.get("producto")), categoria: String(r.get("categoria")), punto: r.get("punto") == null ? null : String(r.get("punto")), stock: r.get("stock") == null ? null : Number(r.get("stock")), historico: Number(r.get("historico") ?? 0), precio: r.get("precio") == null ? null : Number(r.get("precio")) }));
    const base = productoAgotado ? await session.run(
      `MATCH (v:Venta)-[:INCLUYE_PRODUCTO]->(p:Producto {nombre: $producto}) OPTIONAL MATCH (pt:PuntoExpress)-[:REGISTRO]->(v) WHERE $punto IS NULL OR pt.codigo = $punto RETURN avg(v.precioUnitario) AS precio, sum(v.cantidad) AS historico`, { producto: productoAgotado, punto: puntoElegido ?? null }) : null;
    const precioBase = base?.records[0]?.get("precio");
    const historicoBase = Number(base?.records[0]?.get("historico") ?? 0);
     if (productoAgotado) rows = rows.filter((r) => puntoElegido ? r.stock !== null && r.stock > 0 : (r.stock !== null && r.stock > 0) || r.historico > historicoBase);
    rows.sort((a, b) => precioBase == null || a.precio == null || b.precio == null ? b.historico - a.historico : Math.abs(a.precio - Number(precioBase)) - Math.abs(b.precio - Number(precioBase)));
     return rows.map((r) => ({ tipo: "sustitutos", severidad: "baja", producto: r.producto,
       ...(r.punto === null ? {} : { punto: r.punto }),
       ...(r.stock === null ? {} : { cantidadKg: Math.round(r.stock) }),
       motivo: `Categoría ${r.categoria}; ${r.stock == null ? `sin stock registrado, ${r.historico} kg de venta histórica` : `${r.stock} kg de stock disponible${r.punto ? ` en ${r.punto}` : ""}`}. Precio/cercanía solo orientativos.`,
      accion: "Validar sustitución, precio y disponibilidad antes de ofrecer.", confianza: "estimada" }));
  } finally { await session.close(); }
}
