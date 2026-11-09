// Reglas de los horarios de un curso (iguales a las del servidor): la hora de fin es posterior a la de inicio y dos
// horarios del mismo día no se pisan. Sin dependencias del proyecto (se prueba desde server/tests/).
export interface HorarioForm {
  diaSemana: string;
  horaInicio: string;
  horaFin: string;
}

export interface ErrorDeHorario {
  indice: number;
  campo: "horaFin" | null;
  mensaje: string;
}

export function erroresDeHorarios(horarios: HorarioForm[]): ErrorDeHorario[] {
  const errores: ErrorDeHorario[] = [];
  horarios.forEach((h, indice) => {
    if (h.horaFin <= h.horaInicio) errores.push({ indice, campo: "horaFin", mensaje: "La hora de fin tiene que ser posterior a la de inicio" });
  });
  horarios.forEach((a, i) => {
    horarios.forEach((b, j) => {
      if (j > i && a.diaSemana === b.diaSemana && a.horaInicio < b.horaFin && b.horaInicio < a.horaFin) {
        errores.push({ indice: j, campo: null, mensaje: "Dos horarios del mismo día no pueden pisarse" });
      }
    });
  });
  return errores;
}
