import type { QueryKey } from "@tanstack/react-query";
import type { SenalCambio, TipoDato } from "./types";

// Qué consultas hay que volver a pedir cuando cambia cada dato (prefijos de clave de TanStack Query). TanStack vuelve
// a pedir solo las que están en pantalla; las demás quedan marcadas y se piden cuando se abran.
const CLAVES: Record<Exclude<TipoDato, "ciclos">, QueryKey[]> = {
  cuotas: [["cuotas"], ["reportes"]],
  // Una inscripción genera la cuota del mes y cambia la nómina, el cupo y la documentación pendiente.
  alumnos: [["alumnos"], ["cursos"], ["cuotas"], ["documentos"], ["reportes"]],
  cursos: [["cursos"], ["alumnos"], ["reportes"]],
  evaluaciones: [["evaluaciones"], ["calificaciones"], ["reportes"]],
  calificaciones: [["calificaciones"], ["reportes"]],
  "notas-cierre": [["calificaciones"], ["notasCierre"], ["reportes"]],
  asistencia: [["asistencia"], ["reportes"]],
  observaciones: [["observaciones"]],
  categorias: [["categoriasPersonalizadas"]],
  documentos: [["documentos"], ["autorizacionImagen"], ["reportes"]],
  padres: [["padres"], ["pendientes"], ["alumnos"]],
  profesores: [["profesores"], ["pendientes"], ["cursos"]],
  usuarios: [["usuarios"], ["pendientes"]],
  configuracion: [["configuracion"]],
  sesiones: [["sesiones"]],
};

// Activar otro ciclo lectivo cambia todo lo que muestran las pantallas.
export function clavesAfectadas(cambio: SenalCambio): QueryKey[] | "todo" {
  return cambio.dato === "ciclos" ? "todo" : CLAVES[cambio.dato];
}
