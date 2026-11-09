import { z } from "zod";
import { textoRequerido } from "../../core/validacion";

export const crearObservacionSchema = z
  .object({
    alumnoId: z.string().min(1),
    texto: textoRequerido("El texto de la observación", 1000),
    categoria: textoRequerido("La categoría", 80),
  })
  .strict();

export type CrearObservacionInput = z.infer<typeof crearObservacionSchema>;

export const crearCategoriaPersonalizadaSchema = z
  .object({
    cursoId: z.string().min(1),
    nombre: textoRequerido("El nombre de la categoría", 80),
  })
  .strict();

export type CrearCategoriaPersonalizadaInput = z.infer<typeof crearCategoriaPersonalizadaSchema>;
