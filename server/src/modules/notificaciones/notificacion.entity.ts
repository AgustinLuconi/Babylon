import type { Rol } from "../../core/ports";

export type TipoEstado =
  | "cuotas_vencidas"
  | "documentacion_pendiente"
  | "evaluacion_proxima"
  | "asistencia_pendiente"
  | "notas_sin_publicar"
  | "cierre_sin_publicar"
  | "cuota"
  | "documentacion_hijo"
  | "mensajes_familia"
  | "mensajes_instituto"
  | "datos_incompletos"
  | "ciclo_por_cerrar"
  | "alumno_con_deuda"
  | "alumno_con_faltas"
  | "alumno_con_faltas_profesor";
export type TipoEvento =
  | "nota_publicada"
  | "cierre_publicado"
  | "observacion_nueva"
  | "descuento_hermanos_instituto"
  | "descuento_hermanos";
export type TipoNotificacion = TipoEstado | TipoEvento;
export type ClaseNotificacion = "estado" | "evento";
export type TonoNotificacion = "danger" | "warning" | "info";

// A qué lleva el aviso. La dirección no se guarda: la arma el client según el rol (features/notificaciones/rutas.ts).
export type RecursoAviso =
  | { tipo: "cuotas-vencidas" }
  | { tipo: "documentacion-pendiente" }
  | { tipo: "datos-incompletos" }
  | { tipo: "pase-de-anio"; cicloId: string }
  | { tipo: "evaluacion"; cursoId: string; evaluacionId: string }
  | { tipo: "asistencia"; cursoId: string; fecha: string }
  | { tipo: "cierre"; cursoId: string; periodo: string }
  | { tipo: "cuota"; alumnoId: string; cuotaId: string }
  | { tipo: "documentacion"; alumnoId: string }
  | { tipo: "calificaciones"; alumnoId: string }
  | { tipo: "alumno"; alumnoId: string }
  | { tipo: "hijo"; alumnoId: string }
  | { tipo: "chat"; chatId: string };

export interface Destinatario {
  usuarioId: string;
  rol: Rol;
}

// Lo que un criterio dice que tiene que existir para una cuenta y rol.
export interface AvisoEsperado extends Destinatario {
  tipo: TipoNotificacion;
  clave: string;
  tono: TonoNotificacion;
  texto: string;
  recurso: RecursoAviso;
  nivel: number;
}

export interface Notificacion extends AvisoEsperado {
  id: string;
  clase: ClaseNotificacion;
  creadaEn: Date;
  actualizadaEn: Date;
  leidaEn: Date | null;
  resueltaEn: Date | null;
}
