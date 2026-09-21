export type DiaSemana = "lunes" | "martes" | "miercoles" | "jueves" | "viernes" | "sabado";

export interface Horario {
  id: string;
  cursoId: string;
  diaSemana: DiaSemana;
  horaInicio: string;
  horaFin: string;
}
