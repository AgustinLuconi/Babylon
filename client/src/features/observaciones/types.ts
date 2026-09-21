import type { Rol } from "@/features/auth/types";

export type CategoriaObservacionPredefinida = "academico" | "comportamiento" | "felicitacion" | "administrativo";

export const CATEGORIA_LABELS: Record<CategoriaObservacionPredefinida, string> = {
  academico: "Académico",
  comportamiento: "Comportamiento",
  felicitacion: "Felicitación",
  administrativo: "Administrativo",
};

export interface Observacion {
  id: string;
  alumnoId: string;
  emisorId: string;
  emisorRol: Rol;
  fecha: string;
  texto: string;
  categoria: string;
}

export interface ObservacionConEmisor extends Observacion {
  emisorNombre: string;
}

export interface CrearObservacionInput {
  alumnoId: string;
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

export interface CrearCategoriaPersonalizadaInput {
  cursoId: string;
  nombre: string;
}
