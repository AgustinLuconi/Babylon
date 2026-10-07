import "dotenv/config";
import { z } from "zod";

// Variables vacías en el .env (SMTP_HOST="") cuentan como no configuradas.
const opcional = z.string().optional().transform((v) => v || undefined);

const envSchema = z
  .object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1, "DATABASE_URL es requerida"),
  JWT_SECRET: z.string().min(1, "JWT_SECRET es requerida"),
  JWT_EXPIRES_IN: z.string().default("8h"),
  // Duración del token cuando se marca "Mantener sesión iniciada".
  JWT_EXPIRES_IN_RECORDAR: z.string().default("30d"),
  CORS_ORIGIN: z.string().default("http://localhost:5173"),
  // Detrás de un proxy o plataforma de despliegue: la cantidad de saltos ("1") o "false". Sin esto todos los usuarios compartirían la IP del
  // proxy y se bloquearían entre sí en los límites de pedidos.
  TRUST_PROXY: z
    .string()
    .default("false")
    // "true" haría confiar en el primer X-Forwarded-For, que manda el propio cliente: cualquiera
    // esquivaría los límites por IP mandando un encabezado cualquiera. Hay que indicar cuántos
    // proxies hay delante (número de saltos), o "false".
    .refine((v) => v !== "true", 'TRUST_PROXY="true" no es seguro: indicá la cantidad de proxies delante (ej. "1") o "false"'),
  // Envío de correos (recuperación de contraseña). Sin SMTP_HOST, los correos se
  // escriben en la consola del server; en producción es obligatorio.
  SMTP_HOST: opcional,
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_SECURE: z.enum(["true", "false"]).default("false").transform((v) => v === "true"),
  SMTP_USER: opcional,
  SMTP_PASS: opcional,
  MAIL_FROM: z.string().default("Babylon English Institute <no-reply@babylon.local>"),
  // Base de los enlaces que van en los correos (la URL del client).
  APP_URL: opcional,
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV === "production") {
      for (const clave of ["SMTP_HOST", "SMTP_USER", "SMTP_PASS"] as const) {
        if (!env[clave]) ctx.addIssue({ code: "custom", path: [clave], message: `${clave} es requerida en producción` });
      }
    }
  })
  .transform((env) => ({ ...env, APP_URL: env.APP_URL ?? env.CORS_ORIGIN }));

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error("Variables de entorno inválidas:", z.flattenError(parsedEnv.error).fieldErrors);
  throw new Error("Configuración de entorno inválida. Revisá tu archivo .env contra .env.example.");
}

export const config = parsedEnv.data;
