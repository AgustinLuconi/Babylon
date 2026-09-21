import { z } from "zod";

export const crearObservacionSchema = z.object({
  alumnoId: z.string().min(1),
  texto: z.string().min(1, "El texto de la observación es requerido"),
  categoria: z.string().min(1, "La categoría es requerida"),
});

export type CrearObservacionInput = z.infer<typeof crearObservacionSchema>;

export const crearCategoriaPersonalizadaSchema = z.object({
  cursoId: z.string().min(1),
  nombre: z.string().min(1, "El nombre de la categoría es requerido"),
});

export type CrearCategoriaPersonalizadaInput = z.infer<typeof crearCategoriaPersonalizadaSchema>;
