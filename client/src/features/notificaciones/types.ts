export type TipoNotificacion =
  | "cuotas_vencidas"
  | "documentacion_pendiente"
  | "evaluacion_proxima"
  | "asistencia_pendiente"
  | "notas_sin_publicar"
  | "cierre_sin_publicar"
  | "cuota"
  | "documentacion_hijo"
  | "nota_publicada"
  | "cierre_publicado"
  | "observacion_nueva";

export type TonoNotificacion = "danger" | "warning" | "info";

// A qué lleva el aviso (la dirección se arma con rutaDeAviso, según el rol).
export type RecursoAviso =
  | { tipo: "cuotas-vencidas" }
  | { tipo: "documentacion-pendiente" }
  | { tipo: "evaluacion"; cursoId: string; evaluacionId: string }
  | { tipo: "asistencia"; cursoId: string; fecha: string }
  | { tipo: "cierre"; cursoId: string; periodo: string }
  | { tipo: "cuota"; alumnoId: string; cuotaId: string }
  | { tipo: "documentacion"; alumnoId: string }
  | { tipo: "calificaciones"; alumnoId: string }
  | { tipo: "hijo"; alumnoId: string };

export interface Aviso {
  id: string;
  tipo: TipoNotificacion;
  tono: TonoNotificacion;
  texto: string;
  recurso: RecursoAviso;
  leida: boolean;
  resuelta: boolean;
  // Última actualización (ISO).
  fecha: string;
}

export interface Campana {
  noLeidas: number;
  avisos: Aviso[];
}

export type FiltroHistorial = "todas" | "no-leidas" | "pendientes";

export interface PaginaHistorial {
  avisos: Aviso[];
  siguiente: string | null;
}

export interface Preferencia {
  tipo: TipoNotificacion;
  etiqueta: string;
  activa: boolean;
}
