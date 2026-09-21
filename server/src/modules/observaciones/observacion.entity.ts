import type { Rol } from "../../core/ports";

export type CategoriaObservacionPredefinida = "academico" | "comportamiento" | "felicitacion" | "administrativo";

export const CATEGORIAS_PREDEFINIDAS: CategoriaObservacionPredefinida[] = [
  "academico",
  "comportamiento",
  "felicitacion",
  "administrativo",
];

export interface Observacion {
  id: string;
  alumnoId: string;
  emisorId: string;
  emisorRol: Rol;
  fecha: Date;
  texto: string;
  categoria: string;
}

// Categoría creada por un profesor para su propio curso — no se comparte con
// otros cursos ni otros profesores, mismo comportamiento que Evaluacion.
export interface CategoriaPersonalizada {
  id: string;
  cursoId: string;
  profesorId: string;
  nombre: string;
}
