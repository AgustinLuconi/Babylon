import type { Padre } from "../padres/padre.entity";
import type { Alumno } from "./alumno.entity";

// Qué le falta a un alumno para tener su ficha completa. Un alumno se puede inscribir con lo mínimo y completar el resto
// después: esto es lo que marca la lista, filtra Alumnos y alimenta el aviso de la campana.
export type DatoFaltante =
  | "dni"
  | "fechaNacimiento"
  | "responsable"
  | "vinculo"
  | "responsableDni"
  | "responsableTelefono"
  | "responsableEmail";

// Alumno activo e inscripto en el ciclo activo con lo que le falta (mismo universo que la documentación pendiente).
export interface AlumnoConDatosFaltantes {
  alumnoId: string;
  nombre: string;
  faltan: DatoFaltante[];
}

// Criterio único. Sin responsable solo se informa eso (no tiene sentido pedir los datos de una ficha que no existe). Con
// vínculo "propio" el DNI de la ficha es el mismo que el del alumno: se informa una sola vez, como `dni`.
export function datosFaltantes(
  alumno: Pick<Alumno, "dni" | "fechaNacimiento" | "padreId" | "vinculoResponsable">,
  responsable: Pick<Padre, "dni" | "telefono" | "email"> | null,
): DatoFaltante[] {
  const faltan: DatoFaltante[] = [];
  if (!alumno.dni) faltan.push("dni");
  if (!alumno.fechaNacimiento) faltan.push("fechaNacimiento");
  if (!alumno.padreId) {
    faltan.push("responsable");
    return faltan;
  }
  if (!alumno.vinculoResponsable) faltan.push("vinculo");
  if (!responsable) return faltan;
  if (alumno.vinculoResponsable !== "propio" && !responsable.dni) faltan.push("responsableDni");
  if (!responsable.telefono) faltan.push("responsableTelefono");
  if (!responsable.email) faltan.push("responsableEmail");
  return faltan;
}
