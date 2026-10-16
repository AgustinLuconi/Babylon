import type { Rol } from "../../core/ports";
import type { ClaseNotificacion, TipoEstado, TipoNotificacion } from "./notificacion.entity";

type Grupo = "staff" | "profesor" | "padre";

// Catálogo de tipos de aviso: a qué rol le llegan, si son de estado o de evento y cómo se llaman en las preferencias.
export const TIPOS: Record<TipoNotificacion, { grupo: Grupo; clase: ClaseNotificacion; etiqueta: string }> = {
  cuotas_vencidas: { grupo: "staff", clase: "estado", etiqueta: "Cuotas vencidas" },
  documentacion_pendiente: { grupo: "staff", clase: "estado", etiqueta: "Documentación pendiente de los alumnos" },
  evaluacion_proxima: { grupo: "staff", clase: "estado", etiqueta: "Evaluaciones de la próxima semana" },
  asistencia_pendiente: { grupo: "profesor", clase: "estado", etiqueta: "Asistencia sin tomar" },
  notas_sin_publicar: { grupo: "profesor", clase: "estado", etiqueta: "Evaluaciones con notas sin publicar" },
  cierre_sin_publicar: { grupo: "profesor", clase: "estado", etiqueta: "Notas de cierre sin publicar" },
  cuota: { grupo: "padre", clase: "estado", etiqueta: "Cuotas por vencer y vencidas" },
  documentacion_hijo: { grupo: "padre", clase: "estado", etiqueta: "Documentación pendiente" },
  nota_publicada: { grupo: "padre", clase: "evento", etiqueta: "Notas nuevas" },
  cierre_publicado: { grupo: "padre", clase: "evento", etiqueta: "Notas de cierre publicadas" },
  observacion_nueva: { grupo: "padre", clase: "evento", etiqueta: "Observaciones nuevas" },
};

const todos = Object.keys(TIPOS) as TipoNotificacion[];

export const TIPOS_ESTADO = todos.filter((t) => TIPOS[t].clase === "estado") as TipoEstado[];

export function tiposDelRol(rol: Rol): TipoNotificacion[] {
  const grupo: Grupo = rol === "admin" || rol === "secretario" ? "staff" : rol;
  return todos.filter((t) => TIPOS[t].grupo === grupo);
}
