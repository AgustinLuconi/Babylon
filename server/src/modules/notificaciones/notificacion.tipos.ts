import type { Rol } from "../../core/ports";
import type { ClaseNotificacion, TipoEstado, TipoNotificacion } from "./notificacion.entity";

// "admin": avisos que solo recibe el administrador (la secretaría pertenece al grupo "staff" pero no los ve).
type Grupo = "staff" | "admin" | "profesor" | "padre";

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
  mensajes_familia: { grupo: "staff", clase: "estado", etiqueta: "Mensajes nuevos de familias" },
  mensajes_instituto: { grupo: "padre", clase: "estado", etiqueta: "Mensajes nuevos del instituto" },
  datos_incompletos: { grupo: "staff", clase: "estado", etiqueta: "Datos incompletos de los alumnos" },
  ciclo_por_cerrar: { grupo: "admin", clase: "estado", etiqueta: "Año lectivo por cerrar" },
  alumno_con_deuda: { grupo: "staff", clase: "estado", etiqueta: "Alumnos con cuotas vencidas" },
  alumno_con_faltas: { grupo: "staff", clase: "estado", etiqueta: "Alumnos con inasistencias seguidas" },
  alumno_con_faltas_profesor: { grupo: "profesor", clase: "estado", etiqueta: "Alumnos con inasistencias seguidas en mis cursos" },
  alumno_en_riesgo: { grupo: "staff", clase: "estado", etiqueta: "Alumnos en riesgo (deuda e inasistencias)" },
  evaluacion_sin_notas: { grupo: "staff", clase: "estado", etiqueta: "Evaluaciones sin notas" },
  evaluacion_sin_notas_profesor: { grupo: "profesor", clase: "estado", etiqueta: "Evaluaciones sin notas en mis cursos" },
  descuento_hermanos_instituto: { grupo: "staff", clase: "evento", etiqueta: "Cambios en el descuento por hermanos" },
  descuento_hermanos: { grupo: "padre", clase: "evento", etiqueta: "Cambios en el descuento por hermanos" },
};

const todos = Object.keys(TIPOS) as TipoNotificacion[];

export const TIPOS_ESTADO = todos.filter((t) => TIPOS[t].clase === "estado") as TipoEstado[];

export function tiposDelRol(rol: Rol): TipoNotificacion[] {
  const grupo: Grupo = rol === "admin" || rol === "secretario" ? "staff" : rol;
  return todos.filter((t) => TIPOS[t].grupo === grupo || (rol === "admin" && TIPOS[t].grupo === "admin"));
}
