export type TipoDocumento = "formulario_inscripcion" | "copia_dni" | "autorizacion_imagen";
export type EstadoDocumento = "pendiente" | "cargado" | "autorizado" | "revocado";
export type TipoAutorizacion = "digital" | "manual";

export const TIPO_DOCUMENTO_LABELS: Record<TipoDocumento, string> = {
  formulario_inscripcion: "Formulario de inscripción",
  copia_dni: "Copia de DNI",
  autorizacion_imagen: "Autorización de imagen",
};

export const ORDEN_DOCUMENTOS: TipoDocumento[] = ["formulario_inscripcion", "copia_dni", "autorizacion_imagen"];

export interface Documento {
  id: string;
  alumnoId: string;
  tipo: TipoDocumento;
  estado: EstadoDocumento;
  urlArchivo?: string;
  fechaCarga?: string;
  autorizadoPor?: string;
  fechaAutorizacion?: string;
  tipoAutorizacion?: TipoAutorizacion;
}

export interface AutorizarImagenInput {
  alumnoId: string;
}

export interface MarcarCargadoInput {
  tipo: Exclude<TipoDocumento, "autorizacion_imagen">;
}
