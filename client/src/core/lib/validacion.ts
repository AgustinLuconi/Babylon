import { z } from "zod";

// bcrypt (en el server) solo usa los primeros 72 BYTES de la contraseña, no caracteres: lo que sigue se
// descarta en silencio. Las tildes y la ñ ocupan 2 bytes, así que el límite se valida en bytes.
export const MAX_BYTES_PASSWORD = 72;
// Para la persona se explica en caracteres: los comunes cuentan 1 y las tildes y la ñ, 2.
export const MENSAJE_PASSWORD_LARGA = `La contraseña es demasiado larga: el máximo son ${MAX_BYTES_PASSWORD} caracteres (las tildes y la ñ cuentan doble)`;

export const bytesUtf8 = (texto: string) => new TextEncoder().encode(texto).length;

export const passwordNueva = z
  .string()
  .min(8, "La contraseña debe tener al menos 8 caracteres")
  .refine((p) => bytesUtf8(p) <= MAX_BYTES_PASSWORD, MENSAJE_PASSWORD_LARGA);
