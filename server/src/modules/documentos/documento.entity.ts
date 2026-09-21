export type TipoDocumento = "formulario_inscripcion" | "copia_dni" | "autorizacion_imagen";
export type EstadoDocumento = "pendiente" | "cargado" | "autorizado" | "revocado";
export type TipoAutorizacion = "digital" | "manual";

export interface Documento {
  id: string;
  alumnoId: string;
  tipo: TipoDocumento;
  estado: EstadoDocumento;
  urlArchivo?: string;
  fechaCarga?: Date;
  autorizadoPor?: string;
  fechaAutorizacion?: Date;
  tipoAutorizacion?: TipoAutorizacion;
}
