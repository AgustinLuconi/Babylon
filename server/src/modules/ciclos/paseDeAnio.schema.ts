import { z } from "zod";

const destinoDeAlumnosSchema = z.discriminatedUnion("tipo", [
  z.object({ tipo: z.literal("curso"), cursoId: z.string().min(1) }).strict(),
  z.object({ tipo: z.literal("copia"), copiaDe: z.string().min(1) }).strict(),
  z.object({ tipo: z.literal("egresan") }).strict(),
  z.object({ tipo: z.literal("no-continuan") }).strict(),
]);

// Los dos pedidos del asistente (vista previa y confirmación) llevan lo mismo.
export const paseDeAnioSchema = z
  .object({
    origenId: z.string().min(1),
    // El ciclo de destino: uno que ya existe o un año nuevo (se crea al confirmar).
    destino: z.union([
      z.object({ cicloId: z.string().min(1) }).strict(),
      z.object({ anio: z.number({ error: "El año tiene que ser un número" }).int().min(2000, "El año mínimo es 2000").max(2100, "El año máximo es 2100") }).strict(),
    ]),
    copiarCursoIds: z.array(z.string().min(1)),
    cursos: z.array(
      z
        .object({
          cursoOrigenId: z.string().min(1),
          destino: destinoDeAlumnosSchema.optional(),
          excepciones: z.array(z.object({ alumnoId: z.string().min(1), destino: destinoDeAlumnosSchema }).strict()).optional(),
        })
        .strict(),
    ),
    cierre: z.object({ activarDestino: z.boolean(), bloquearOrigen: z.boolean() }).strict().optional(),
  })
  .strict();

export type PaseDeAnioInput = z.infer<typeof paseDeAnioSchema>;
