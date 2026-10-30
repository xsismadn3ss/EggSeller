export type Severidad = "critica" | "alta" | "media" | "baja";

export interface Sugerencia {
  tipo: "quiebre" | "estacional" | "sustitutos";
  severidad: Severidad;
  producto: string;
  punto?: string;
  cantidadKg?: number;
  precioPromedio?: number;
  fechaCorte?: string;
  detalle?: string;
  motivo: string;
  accion: string;
  confianza: "confirmada" | "estimada";
}
