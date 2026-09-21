export type NivelCurso = "kids" | "teens_a1" | "teens_a2" | "adults_b1" | "adults_b2" | "cambridge_prep";
export type EstadoCurso = "activo" | "inactivo";

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
