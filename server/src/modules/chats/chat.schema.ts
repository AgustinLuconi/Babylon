import { z } from "zod";

export const enviarMensajeSchema = z.object({
  texto: z.string().min(1, "El mensaje no puede estar vacío"),
});

export const iniciarConversacionSchema = z.object({ padreId: z.string().min(1) });
// Lo que quien lee tenía en pantalla: los ids de los mensajes y, si hay páginas anteriores sin cargar, la fecha del más
// viejo cargado (`antesDe`). Sin nada, se marca todo.
export const marcarLeidoSchema = z.object({
  ids: z.array(z.string().min(1)).max(1000).optional(),
  antesDe: z.coerce.date().optional(),
});
export const paginaDeMensajesSchema = z.object({ antesDe: z.string().min(1).optional() });

export type EnviarMensajeInput = z.infer<typeof enviarMensajeSchema>;
