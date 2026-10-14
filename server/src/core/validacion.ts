import { z } from "zod";

// bcrypt solo usa los primeros 72 BYTES de la contraseña (no caracteres): lo que sigue se descarta en
// silencio. Las tildes y la ñ ocupan 2 bytes, así que se valida en bytes para no aceptar una contraseña
// que luego quedaría truncada.
// Para la persona se explica en caracteres: los comunes cuentan 1 y las tildes y la ñ, 2.
export const MAX_BYTES_PASSWORD = 72;

export const passwordNueva = z
  .string()
  .min(8, "La contraseña debe tener al menos 8 caracteres")
  .refine(
    (p) => Buffer.byteLength(p, "utf8") <= MAX_BYTES_PASSWORD,
    `La contraseña es demasiado larga: el máximo son ${MAX_BYTES_PASSWORD} caracteres (las tildes y la ñ cuentan doble)`,
  );
