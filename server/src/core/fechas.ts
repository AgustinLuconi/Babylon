// Fechas "de calendario" del instituto. Toda regla que dependa de qué día u hora
// es (vencimientos, generación mensual, "hoy" en los reportes) se calcula en hora
// de Argentina, sin importar en qué región o huso horario corra el servidor.
export const ZONA_HORARIA = "America/Argentina/Buenos_Aires";

export interface FechaHoraCivil {
  anio: number;
  mes: number; // 1..12
  dia: number;
  hora: number; // 0..23
  minuto: number;
  segundo: number;
}

const formateador = new Intl.DateTimeFormat("en-US", {
  timeZone: ZONA_HORARIA,
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "numeric",
  minute: "numeric",
  second: "numeric",
  hourCycle: "h23",
});

// Año/mes/día/hora del instante dado, tal como se ven en Argentina.
export function fechaHoraEnArgentina(instante: Date = new Date()): FechaHoraCivil {
  const partes = Object.fromEntries(formateador.formatToParts(instante).map((p) => [p.type, Number(p.value)]));
  return {
    anio: partes.year,
    mes: partes.month,
    dia: partes.day,
    hora: partes.hour,
    minuto: partes.minute,
    segundo: partes.second,
  };
}

// Medianoche UTC del día calendario argentino de `instante`: es la forma en que se
// guardan las fechas calendario (vencimientos, fechas de evaluación) y por lo tanto
// contra lo que hay que compararlas para saber si son anteriores/posteriores a hoy.
export function inicioDeHoyUtc(instante: Date = new Date()): Date {
  const { anio, mes, dia } = fechaHoraEnArgentina(instante);
  return new Date(Date.UTC(anio, mes - 1, dia));
}
