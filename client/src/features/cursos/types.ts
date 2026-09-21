export type NivelCurso = "kids" | "teens_a1" | "teens_a2" | "adults_b1" | "adults_b2" | "cambridge_prep";
export type EstadoCurso = "activo" | "inactivo";

export const NIVEL_LABELS: Record<NivelCurso, string> = {
  kids: "Kids",
  teens_a1: "Teens A1",
  teens_a2: "Teens A2",
  adults_b1: "Adults B1",
  adults_b2: "Adults B2",
  cambridge_prep: "Cambridge Prep",
};

// Agrupa los 6 niveles en las 4 familias de color que usa .level-pill
export const NIVEL_GRUPO: Record<NivelCurso, "kids" | "teens" | "adults" | "cambridge"> = {
  kids: "kids",
  teens_a1: "teens",
  teens_a2: "teens",
  adults_b1: "adults",
  adults_b2: "adults",
  cambridge_prep: "cambridge",
};

export interface Curso {
  id: string;
  nombre: string;
  nivel: NivelCurso;
  profesorId: string;
  cicloId: string;
  aula?: string;
  cupo: number;
  estado: EstadoCurso;
}

export type DiaSemana = "lunes" | "martes" | "miercoles" | "jueves" | "viernes" | "sabado";

export const DIA_SEMANA_LABELS: Record<DiaSemana, string> = {
  lunes: "Lunes",
  martes: "Martes",
  miercoles: "Miércoles",
  jueves: "Jueves",
  viernes: "Viernes",
  sabado: "Sábado",
};

export interface HorarioInput {
  diaSemana: DiaSemana;
  horaInicio: string;
  horaFin: string;
}

export interface CrearCursoInput {
  nombre: string;
  nivel: NivelCurso;
  profesorId: string;
  aula?: string;
  cupo: number;
  horarios: HorarioInput[];
}

export interface Horario {
  id: string;
  cursoId: string;
  diaSemana: DiaSemana;
  horaInicio: string;
  horaFin: string;
}

export interface ActualizarCursoInput {
  nombre?: string;
  nivel?: NivelCurso;
  profesorId?: string;
  aula?: string;
  cupo?: number;
  estado?: EstadoCurso;
  horarios?: HorarioInput[];
}
