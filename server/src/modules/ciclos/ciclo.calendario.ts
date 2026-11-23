// Reglas puras del calendario de un ciclo lectivo: cuándo hay clases. Trabajan con días AAAA-MM-DD (nunca con instantes),
// así no dependen de la zona horaria. Hay una copia idéntica en el client (features/ciclos/calendario.ts); la tabla de
// casos de server/tests/casos-calendario.ts corre contra las dos.

export interface PausaDeCalendario {
  desde: string;
  hasta: string;
  nombre: string;
}

export interface CalendarioDelCiclo {
  anio: number;
  inicio: string;
  fin: string;
  pausas: PausaDeCalendario[];
}

// Sin fechas cargadas, el ciclo va del 1 de marzo al 30 de noviembre y no tiene pausas.
export function calendarioPorDefecto(anio: number): CalendarioDelCiclo {
  return { anio, inicio: `${anio}-03-01`, fin: `${anio}-11-30`, pausas: [] };
}

// null si ese día hay clases; si no, por qué no: "Fuera del ciclo lectivo" o el nombre de la pausa.
export function motivoSinClases(fecha: string, calendario: CalendarioDelCiclo): string | null {
  if (fecha < calendario.inicio || fecha > calendario.fin) return "Fuera del ciclo lectivo";
  const pausa = calendario.pausas.find((p) => fecha >= p.desde && fecha <= p.hasta);
  return pausa ? pausa.nombre : null;
}

// Un mes es lectivo si tiene al menos un día de clases (una pausa no anula el mes, salvo que lo cubra entero).
export function esMesLectivo(mes: number, calendario: CalendarioDelCiclo): boolean {
  const diasDelMes = new Date(Date.UTC(calendario.anio, mes, 0)).getUTCDate();
  const mm = String(mes).padStart(2, "0");
  for (let dia = 1; dia <= diasDelMes; dia++) {
    if (motivoSinClases(`${calendario.anio}-${mm}-${String(dia).padStart(2, "0")}`, calendario) === null) return true;
  }
  return false;
}

// Mensaje de error, o null si las fechas (y las pausas ya cargadas) son coherentes.
export function validarFechasDelCiclo(calendario: CalendarioDelCiclo): string | null {
  if (calendario.inicio > calendario.fin) return "La fecha de inicio no puede ser posterior a la de fin";
  const anio = String(calendario.anio);
  if (calendario.inicio.slice(0, 4) !== anio || calendario.fin.slice(0, 4) !== anio) return `Las fechas tienen que estar dentro del año ${calendario.anio}`;
  const afuera = calendario.pausas.find((p) => p.desde < calendario.inicio || p.hasta > calendario.fin);
  return afuera ? `La pausa "${afuera.nombre}" quedaría fuera del ciclo` : null;
}

export function validarPausa(calendario: CalendarioDelCiclo, nueva: PausaDeCalendario, otras: PausaDeCalendario[]): string | null {
  if (nueva.desde > nueva.hasta) return "La pausa tiene que terminar el mismo día o después de empezar";
  if (nueva.desde < calendario.inicio || nueva.hasta > calendario.fin) return "La pausa tiene que estar dentro del ciclo lectivo";
  const choca = otras.find((o) => nueva.desde <= o.hasta && o.desde <= nueva.hasta);
  return choca ? `La pausa se superpone con "${choca.nombre}"` : null;
}
