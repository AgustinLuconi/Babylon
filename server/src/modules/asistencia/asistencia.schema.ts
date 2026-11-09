import { z } from "zod";
import { fechaDeAsistenciaSchema, textoOpcional } from "../../core/validacion";

export const registrarAsistenciaMasivaSchema = z
  .object({
    cursoId: z.string().min(1),
    fecha: fechaDeAsistenciaSchema,
    registros: z
      .array(
        z
          .object({
            alumnoId: z.string().min(1),
            estado: z.enum(["presente", "tarde", "ausente"]),
            minutosRetraso: z.number().int().nonnegative().max(600).optional(),
            motivo: textoOpcional(200),
          })
          .strict(),
      )
      .min(1, "Debe incluir al menos un alumno"),
  })
  .strict();

export type RegistrarAsistenciaMasivaInput = z.infer<typeof registrarAsistenciaMasivaSchema>;
