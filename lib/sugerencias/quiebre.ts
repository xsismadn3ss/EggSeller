import { getSession } from "../neo4j";
import type { Sugerencia } from "./types";

export async function getRiesgoQuiebre(desde?: string, hasta?: string, puntoElegido?: string): Promise<Sugerencia[]> {
  const session = getSession();
  try {
    const result = await session.run(
      `MATCH (v:Venta)-[:INCLUYE_PRODUCTO]->(p:Producto)
       WHERE ($desde IS NULL OR v.fecha >= date($desde))
         AND ($hasta IS NULL OR v.fecha <= date($hasta))
       OPTIONAL MATCH (pt:PuntoExpress)-[:REGISTRO]->(v)
       OPTIONAL MATCH (cli:Cliente)-[:REALIZO]->(v)
       OPTIONAL MATCH (cli)-[:UBICADO_EN]->(z:ZonaGeografica)
        WITH p, coalesce(pt.codigo, z.nombre, 'general') AS punto, v
        WHERE ($punto IS NULL OR punto = $punto)
       WITH p, punto, max(v.fecha) AS fechaSnapshot, sum(v.cantidad) AS historico
       MATCH (snapshot:Venta)-[:INCLUYE_PRODUCTO]->(p)
       OPTIONAL MATCH (snapshotPt:PuntoExpress)-[:REGISTRO]->(snapshot)
       OPTIONAL MATCH (snapshotCli:Cliente)-[:REALIZO]->(snapshot)
       OPTIONAL MATCH (snapshotCli)-[:UBICADO_EN]->(snapshotZona:ZonaGeografica)
       WITH p, punto, fechaSnapshot, historico, snapshot,
            coalesce(snapshotPt.codigo, snapshotZona.nombre, 'general') AS snapshotPunto
        WHERE snapshot.fecha = fechaSnapshot AND snapshotPunto = punto AND ($punto IS NULL OR snapshotPunto = $punto)
       WITH p.nombre AS producto, punto,
             max(snapshot.stockDisponible) AS stock,
             max(snapshot.demanda30d) AS demanda,
              max(snapshot.stockSeguridad) AS seguridad,
              avg(snapshot.precioUnitario) AS precioPromedio,
              max(snapshot.fecha) AS fechaCorte,
              historico
        RETURN producto, punto, stock, demanda, seguridad, historico, precioPromedio, toString(fechaCorte) AS fechaCorte`,
       { desde: desde ?? null, hasta: hasta ?? null, punto: puntoElegido ?? null },
    );
    const porProducto = new Map<string, Array<{
      punto: string;
      stock: number | null;
      demanda: number | null;
      demandaBase: number;
      pedido: number;
      severidad: Sugerencia["severidad"];
      estimada: boolean;
      precioPromedio: number | null;
      fechaCorte: string | null;
    }>>();
    for (const r of result.records) {
      const producto = String(r.get("producto"));
      const punto = String(r.get("punto"));
      const stock = r.get("stock") == null ? null : Number(r.get("stock"));
      const demanda = r.get("demanda") == null ? null : Number(r.get("demanda"));
      const seguridad = Number(r.get("seguridad") ?? 0);
      const demandaBase = demanda ?? Number(r.get("historico") ?? 0);
      const pedido = Math.max(0, demandaBase + seguridad - (stock ?? 0));
      const severidad = stock === null ? "baja" : stock <= 0 || (demandaBase > 0 && stock < demandaBase * 0.5) ? "critica" : stock < demandaBase ? "alta" : stock < demandaBase * 1.5 ? "media" : "baja";
      const estimada = stock === null || demanda === null;
      const puntos = porProducto.get(producto) ?? [];
      const precioPromedio = r.get("precioPromedio") == null ? null : Number(r.get("precioPromedio"));
      const fechaCorte = r.get("fechaCorte") == null ? null : String(r.get("fechaCorte"));
      puntos.push({ punto, stock, demanda, demandaBase, pedido, severidad, estimada, precioPromedio, fechaCorte });
      porProducto.set(producto, puntos);
    }

    const orden: Record<Sugerencia["severidad"], number> = { critica: 4, alta: 3, media: 2, baja: 1 };
    const filas = Array.from(porProducto, ([producto, puntos]) => {
      const clasificados = [...puntos].sort((a, b) =>
        orden[b.severidad] - orden[a.severidad] || b.pedido - a.pedido,
      );
      const peor = clasificados[0];
      const severidad = peor.severidad;
      const cantidadKg = Math.round(puntos.reduce((total, punto) => total + (punto.pedido > 0 ? punto.pedido : 0), 0) * 100) / 100;
      const enRiesgo = puntos.filter((punto) => orden[punto.severidad] >= orden.media);
      const stockTexto = peor.stock === null ? "sin registro" : `${peor.stock}`;
      const demandaTexto = peor.demanda === null ? `${peor.demandaBase} (histórica)` : `${peor.demanda}`;
      const motivo = `${enRiesgo.length} de ${puntos.length} puntos en riesgo. Peor caso: ${peor.punto} con ${stockTexto} kg frente a ${demandaTexto} kg de demanda.${enRiesgo.length ? ` Puntos en riesgo: ${enRiesgo.map((punto) => punto.punto).join(", ")}.` : ""}`;
      const detalle = [...puntos].sort((a, b) => b.pedido - a.pedido).slice(0, 3)
        .map((punto) => `${punto.punto}: ${Math.round(Math.max(0, punto.pedido) * 100) / 100}kg (stock ${punto.stock ?? "sin registro"})`).join("; ");
      const precioPromedio = puntos.reduce((sum, item) => sum + (item.precioPromedio ?? 0), 0) / (puntos.filter((item) => item.precioPromedio !== null).length || 1);
      const fechaCorte = puntos.map((item) => item.fechaCorte).filter((fecha): fecha is string => fecha !== null).sort().at(-1);
      if (puntoElegido) {
        return {
          tipo: "quiebre",
          producto,
          punto: peor.punto,
          severidad,
          cantidadKg,
          ...(puntos.some((item) => item.precioPromedio !== null) ? { precioPromedio } : {}),
          ...(fechaCorte ? { fechaCorte } : {}),
          motivo: `Stock ${stockTexto} kg frente a ${demandaTexto} kg de demanda en ${peor.punto}.`,
          accion: cantidadKg > 0 ? `Evaluar pedido de ${cantidadKg} kg.` : "Verificar inventario y demanda antes de pedir.",
          confianza: puntos.some((punto) => punto.estimada) ? "estimada" : "confirmada",
        } as Sugerencia;
      }
      return {
        tipo: "quiebre",
        producto,
        severidad,
        cantidadKg,
        ...(puntos.some((item) => item.precioPromedio !== null) ? { precioPromedio } : {}),
        ...(fechaCorte ? { fechaCorte } : {}),
        detalle,
        motivo,
        accion: cantidadKg > 0 ? `Evaluar pedido de ${cantidadKg} kg.` : "Verificar inventario y demanda antes de pedir.",
        confianza: puntos.some((punto) => punto.estimada) ? "estimada" : "confirmada",
      } as Sugerencia;
    });
    return puntoElegido
      ? filas.sort((a, b) => orden[b.severidad] - orden[a.severidad] || (b.cantidadKg ?? 0) - (a.cantidadKg ?? 0))
      : filas.flatMap((fila) => {
          const productoPuntos = porProducto.get(fila.producto) ?? [];
          return productoPuntos.map((punto) => ({
            ...fila,
            punto: punto.punto,
            severidad: punto.severidad,
            cantidadKg: Math.round(Math.max(0, punto.pedido) * 100) / 100,
            ...(punto.precioPromedio === null ? {} : { precioPromedio: punto.precioPromedio }),
            ...(punto.fechaCorte ? { fechaCorte: punto.fechaCorte } : {}),
            motivo: `Stock ${punto.stock === null ? "sin registro" : punto.stock} kg frente a ${punto.demanda === null ? `${punto.demandaBase} (histórica)` : punto.demanda} kg de demanda en ${punto.punto}.`,
            accion: punto.pedido > 0 ? `Evaluar pedido de ${Math.round(punto.pedido * 100) / 100} kg.` : "Verificar inventario y demanda antes de pedir.",
            confianza: punto.estimada ? "estimada" as const : "confirmada" as const,
          }));
        }).sort((a, b) => (a.punto ?? "").localeCompare(b.punto ?? "") || orden[b.severidad] - orden[a.severidad]);
  } finally { await session.close(); }
}
