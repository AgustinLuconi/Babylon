import { z } from "zod";
import { textoRequerido } from "../../core/validacion";

export const enviarMensajeSchema = z.object({ texto: textoRequerido("El mensaje", 2000) }).strict();

export const corregirMensajeSchema = enviarMensajeSchema;

export const iniciarConversacionSchema = z.object({ padreId: z.string().min(1) }).strict();
// Lo que quien lee tenía en pantalla: los ids de los mensajes y, si hay páginas anteriores sin cargar, la fecha del más
// viejo cargado (`antesDe`). Sin nada, se marca todo.
export const marcarLeidoSchema = z
  .object({
    ids: z.array(z.string().min(1)).max(1000).optional(),
    antesDe: z.coerce.date().optional(),
  })
  .strict();
export const paginaDeMensajesSchema = z.object({ antesDe: z.string().min(1).optional() });

export type EnviarMensajeInput = z.infer<typeof enviarMensajeSchema>;
