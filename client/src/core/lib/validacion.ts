import { z } from "zod";
import { hoyLocalISO } from "./utils";

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

// ── Reglas de validación de datos de formularios ──────────────────────────────────────────────────────────
// Hay una copia idéntica en server/src/core/validacion.ts (server y client no comparten código):
// server/tests/validacion.test.ts corre la misma tabla de casos contra las dos.

export const recortar = (texto: string): string => texto.trim();

// Solo DNI argentino: 7 u 8 dígitos, con o sin puntos. Se guarda solo con los dígitos.
export function normalizarDni(texto: string): string | null {
  const limpio = texto.trim().replace(/\./g, "");
  return /^\d{7,8}$/.test(limpio) ? limpio : null;
}

// Celular argentino escrito como lo escribe la gente. Se guarda siempre como +549 y los 10 dígitos
// (código de área + número, sin el 0 ni el 15).
export function normalizarCelular(texto: string): string | null {
  const compacto = texto.trim().replace(/[\s.\-()]/g, "");
  if (!/^\+?\d+$/.test(compacto)) return null;
  let digitos = compacto.replace(/^\+/, "");
  if (digitos.startsWith("54") && digitos.length >= 12) {
    digitos = digitos.slice(2);
    if (digitos.startsWith("9")) digitos = digitos.slice(1);
  }
  if (digitos.startsWith("0")) digitos = digitos.slice(1);
  // Con el 15 de los celulares quedan 12 dígitos: el 15 va justo después del código de área (2, 3 o 4 dígitos).
  if (digitos.length === 12) {
    for (const largoArea of [2, 3, 4]) {
      if (digitos.slice(largoArea, largoArea + 2) === "15") {
        digitos = digitos.slice(0, largoArea) + digitos.slice(largoArea + 2);
        break;
      }
    }
  }
  if (!/^[1-9]\d{9}$/.test(digitos) || digitos.startsWith("800")) return null;
  return `+549${digitos}`;
}

export const normalizarEmail = (texto: string): string => texto.trim().toLowerCase();

// Fecha real del calendario y edad entre 2 y 100 años cumplidos al día de hoy (AAAA-MM-DD, hora de Argentina).
export function fechaNacimientoValida(fechaISO: string, hoyISO: string): boolean {
  const f = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fechaISO);
  const h = /^(\d{4})-(\d{2})-(\d{2})$/.exec(hoyISO);
  if (!f || !h) return false;
  const [anio, mes, dia] = [Number(f[1]), Number(f[2]), Number(f[3])];
  const real = new Date(Date.UTC(anio, mes - 1, dia));
  if (real.getUTCFullYear() !== anio || real.getUTCMonth() !== mes - 1 || real.getUTCDate() !== dia) return false;
  const [hoyAnio, hoyMes, hoyDia] = [Number(h[1]), Number(h[2]), Number(h[3])];
  const edad = hoyAnio - anio - (hoyMes < mes || (hoyMes === mes && hoyDia < dia) ? 1 : 0);
  return edad >= 2 && edad <= 100;
}

export const textoRequerido = (etiqueta: string, max: number) =>
  z
    .string({ error: `${etiqueta} es requerido` })
    .trim()
    .min(1, `${etiqueta} es requerido`)
    .max(max, `${etiqueta} admite hasta ${max} caracteres`);

// Texto con tope de largo, sin exigir que no esté vacío (se combina con `opcional` o `borrable`).
export const texto = (max: number) => z.string().trim().max(max, `Admite hasta ${max} caracteres`);

// Opcional: un texto de puros espacios cuenta como vacío (queda "sin dato").
export const textoOpcional = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Admite hasta ${max} caracteres`)
    .transform((t) => (t === "" ? undefined : t))
    .optional();

function normalizado(mensaje: string, normalizar: (texto: string) => string | null) {
  return z
    .string({ error: mensaje })
    .refine((t) => normalizar(t) !== null, mensaje)
    .transform((t) => normalizar(t) as string);
}

export const dniSchema = normalizado("El DNI no es válido: tiene que tener 7 u 8 números", normalizarDni);
export const celularSchema = normalizado(
  "El celular no es válido: escribilo con el código de área, por ejemplo 351 555-1234",
  normalizarCelular,
);
export const emailSchema = z
  .string({ error: "Email inválido" })
  .transform(normalizarEmail)
  .pipe(z.email("Email inválido"));
export const fechaNacimientoSchema = z
  .string({ error: "La fecha de nacimiento no es válida" })
  .refine((t) => fechaNacimientoValida(t.trim(), hoyLocalISO()), "La fecha de nacimiento no es válida: tiene que ser una fecha real, de una persona de entre 2 y 100 años")
  .transform((t) => t.trim());

// Al crear: vacío o ausente = sin dato.
export const opcional = <T extends z.ZodType>(schema: T) =>
  z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), schema.optional());

// Al editar: ausente = no se toca; vacío o null = se borra el dato.
export const borrable = <T extends z.ZodType>(schema: T) =>
  z.preprocess((v) => (v === null || (typeof v === "string" && v.trim() === "") ? null : v), schema.nullable().optional());
