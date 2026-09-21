import { z } from "zod";

export const enviarMensajeSchema = z.object({
  texto: z.string().min(1, "El mensaje no puede estar vacío"),
});

export type EnviarMensajeInput = z.infer<typeof enviarMensajeSchema>;
