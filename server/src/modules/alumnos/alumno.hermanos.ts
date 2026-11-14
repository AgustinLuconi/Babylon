// Descuento por hermanos: regla única, pura (sin Prisma ni Express). Entre los alumnos activos de un mismo
// responsable, paga completo el que se inscribió primero y los demás tienen descuento. Un alumno inactivo o egresado
// no cuenta ni lo recibe. Hay una copia con los mismos nombres en el client (no comparten código).

export interface AlumnoParaDescuento {
  id: string;
  estado: "activo" | "inactivo" | "egresado";
  fechaInscripcion: Date;
  aplicaDescuentoHermanos: boolean;
}

// Más antiguo primero; a igual fecha, por id, para que el resultado sea siempre el mismo.
function activosPorAntiguedad(alumnos: AlumnoParaDescuento[]): AlumnoParaDescuento[] {
  return alumnos
    .filter((a) => a.estado === "activo")
    .sort((a, b) => a.fechaInscripcion.getTime() - b.fechaInscripcion.getTime() || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

// Id del alumno activo que paga la cuota completa; null si no hay ninguno activo.
export function quienPagaCompleto(alumnos: AlumnoParaDescuento[]): string | null {
  return activosPorAntiguedad(alumnos)[0]?.id ?? null;
}

// Ids de los alumnos que tienen el descuento (solo activos, todos menos el primero).
export function alumnosConDescuento(alumnos: AlumnoParaDescuento[]): Set<string> {
  return new Set(activosPorAntiguedad(alumnos).slice(1).map((a) => a.id));
}

// Alumnos activos cuya marca guardada no coincide con la que corresponde. Los inactivos no se tocan.
export function correccionesDeDescuento(alumnos: AlumnoParaDescuento[]): { alumnoId: string; aplica: boolean }[] {
  const conDescuento = alumnosConDescuento(alumnos);
  return alumnos
    .filter((a) => a.estado === "activo" && a.aplicaDescuentoHermanos !== conDescuento.has(a.id))
    .map((a) => ({ alumnoId: a.id, aplica: conDescuento.has(a.id) }));
}
