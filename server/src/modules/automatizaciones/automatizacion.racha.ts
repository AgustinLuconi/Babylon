// La racha de inasistencias de un alumno en un curso: desde el registro más nuevo hacia atrás, cuántos seguidos son
// "ausente" y no justificada. Cualquier otro registro (presente, tarde o una ausencia justificada) la corta. Función pura.
export interface RegistroDeRacha {
  fecha: Date;
  estado: "presente" | "tarde" | "ausente";
  justificada: boolean;
}

export function rachaDeInasistencias(registros: RegistroDeRacha[]): number {
  const masNuevosPrimero = [...registros].sort((a, b) => b.fecha.getTime() - a.fecha.getTime());
  let racha = 0;
  for (const r of masNuevosPrimero) {
    if (r.estado !== "ausente" || r.justificada) break;
    racha++;
  }
  return racha;
}
