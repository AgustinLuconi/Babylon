import { z } from "zod";

export const crearEvaluacionSchema = z.object({
  cursoId: z.string().min(1),
  nombre: z.string().min(1, "El nombre de la evaluación es requerido"),
  tipo: z.enum(["examen", "trabajo_practico", "oral", "proyecto"]),
  fecha: z.coerce.date(),
  periodo: z.enum(["julio", "noviembre"]),
  escala: z.enum(["numerica", "conceptual"]),
});

export type CrearEvaluacionInput = z.infer<typeof crearEvaluacionSchema>;

export const cargarCalificacionesSchema = z.object({
  notas: z
    .array(
      z.object({
        alumnoId: z.string().min(1),
        nota: z.string().min(1),
        observacion: z.string().max(200, "La observación admite hasta 200 caracteres").optional(),
      }),
    )
    .min(1, "Debe cargar al menos una nota"),
});

export type CargarCalificacionesInput = z.infer<typeof cargarCalificacionesSchema>;

export const cargarNotaCierreSchema = z.object({
  alumnoId: z.string().min(1),
  cursoId: z.string().min(1),
  periodo: z.enum(["julio", "noviembre"]),
  nota: z.string().min(1),
  observacion: z.string().max(200, "La observación admite hasta 200 caracteres").optional(),
});

export type CargarNotaCierreInput = z.infer<typeof cargarNotaCierreSchema>;
