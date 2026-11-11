import { z } from "zod";
import { fechaDeEvaluacionSchema, notaNumericaSchema, textoOpcional, textoRequerido } from "../../core/validacion";

export const crearEvaluacionSchema = z
  .object({
    cursoId: z.string().min(1),
    nombre: textoRequerido("El nombre de la evaluación", 80),
    tipo: z.enum(["examen", "trabajo_practico", "oral", "proyecto"]),
    fecha: fechaDeEvaluacionSchema,
    periodo: z.enum(["julio", "noviembre"]),
  })
  .strict();

export type CrearEvaluacionInput = z.infer<typeof crearEvaluacionSchema>;

export const cargarCalificacionesSchema = z
  .object({
    notas: z
      .array(
        z
          .object({
            alumnoId: z.string().min(1),
            nota: notaNumericaSchema(0),
            observacion: textoOpcional(200),
          })
          .strict(),
      )
      .min(1, "Debe cargar al menos una nota"),
  })
  .strict();

export type CargarCalificacionesInput = z.infer<typeof cargarCalificacionesSchema>;

export const cargarNotaCierreSchema = z
  .object({
    alumnoId: z.string().min(1),
    cursoId: z.string().min(1),
    periodo: z.enum(["julio", "noviembre"]),
    nota: notaNumericaSchema(1),
    observacion: textoOpcional(200),
  })
  .strict();

export type CargarNotaCierreInput = z.infer<typeof cargarNotaCierreSchema>;

// Lotes de notas de cierre (la pantalla guarda y publica el curso entero de una vez).
export const cargarNotasCierreSchema = z.object({ notas: z.array(cargarNotaCierreSchema).min(1).max(100) }).strict();
export const publicarNotasCierreSchema = z.object({ ids: z.array(z.string().min(1)).min(1).max(100) }).strict();
