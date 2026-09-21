import { z } from "zod";

export const registrarAsistenciaMasivaSchema = z.object({
  cursoId: z.string().min(1),
  fecha: z.coerce.date(),
  registros: z
    .array(
      z.object({
        alumnoId: z.string().min(1),
        estado: z.enum(["presente", "tarde", "ausente"]),
        minutosRetraso: z.number().int().nonnegative().optional(),
        motivo: z.string().optional(),
      }),
    )
    .min(1, "Debe incluir al menos un alumno"),
});

export type RegistrarAsistenciaMasivaInput = z.infer<typeof registrarAsistenciaMasivaSchema>;
