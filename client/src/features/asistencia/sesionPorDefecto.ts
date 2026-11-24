// La clase con la que abre la pantalla de asistencia: la más reciente que cae en un día con clases (no en un feriado ni en
// una pausa del calendario del ciclo). Si ninguna lo es, la más reciente: la pantalla avisa que ese día no hay clases.
// `sesiones` son días AAAA-MM-DD de la más reciente a la más vieja. Función pura (se prueba desde server/tests/).
export function sesionPorDefecto(sesiones: string[], tieneClases: (dia: string) => boolean): string | null {
  return sesiones.find(tieneClases) ?? sesiones[0] ?? null;
}
