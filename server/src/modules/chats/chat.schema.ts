import { z } from "zod";

export const enviarMensajeSchema = z.object({
  texto: z.string().min(1, "El mensaje no puede estar vacío"),
});

export const iniciarConversacionSchema = z.object({ padreId: z.string().min(1) });
// `hasta`: la hora del último mensaje que quien lee tenía en pantalla (lo que llegó después no se marca).
export const marcarLeidoSchema = z.object({ hasta: z.coerce.date().optional() });

export type EnviarMensajeInput = z.infer<typeof enviarMensajeSchema>;
