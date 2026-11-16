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
            // Solo una ausencia se justifica, y entonces el motivo es obligatorio.
            justificada: z.boolean().optional(),
          })
          .strict()
          .superRefine((registro, ctx) => {
            if (registro.justificada !== true) return;
            if (registro.estado !== "ausente") ctx.addIssue({ code: "custom", path: ["justificada"], message: "Solo una ausencia se puede justificar" });
            if (!registro.motivo) ctx.addIssue({ code: "custom", path: ["motivo"], message: "Para justificar la ausencia hay que escribir el motivo" });
          }),
      )
      .min(1, "Debe incluir al menos un alumno"),
  })
  .strict();

export type RegistrarAsistenciaMasivaInput = z.infer<typeof registrarAsistenciaMasivaSchema>;
