import { z } from "zod";

export const autorizarImagenSchema = z.object({
  alumnoId: z.string().min(1),
});

export type AutorizarImagenInput = z.infer<typeof autorizarImagenSchema>;

export const marcarCargadoSchema = z.object({
  tipo: z.enum(["formulario_inscripcion", "copia_dni"]),
});

export type MarcarCargadoInput = z.infer<typeof marcarCargadoSchema>;
