// Los meses que se pueden recorrer en el calendario de asistencia, del más nuevo al más viejo. Se arman con las fechas de las filas
// de asistencia **y** con las de las clases sin dictar: un mes con una sola clase sin dar tiene que poder verse aunque ese alumno no
// tenga ninguna fila ese mes. Función pura (se prueba desde server/tests/).
export function mesesDeFechas(fechas: string[]): { anio: number; mes: number }[] {
  const mapa = new Map<string, { anio: number; mes: number }>();
  for (const fecha of fechas) {
    const [anio, mes] = fecha.slice(0, 10).split("-").map(Number);
    mapa.set(`${anio}-${mes}`, { anio, mes });
  }
  return Array.from(mapa.values()).sort((a, b) => b.anio - a.anio || b.mes - a.mes);
}
