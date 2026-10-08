import { z } from "zod";
import { passwordNueva } from "../../core/validacion";

const rolSchema = z.enum(["admin", "secretario", "profesor", "padre"]);

// Email sin espacios y en minúsculas antes de validarlo: " Admin@Babylon.test "
// es la misma cuenta que "admin@babylon.test".
const emailNormalizado = z.preprocess((v) => (typeof v === "string" ? v.trim().toLowerCase() : v), z.email("Email inválido"));

export const credencialesSchema = z.object({
  email: emailNormalizado,
  password: z.string().min(1, "La contraseña es requerida"),
  // Solo se necesita cuando la cuenta tiene más de un rol habilitado y ya se
  // sabe con cuál se quiere entrar (segundo paso del login).
  rolElegido: rolSchema.optional(),
  // "Mantener sesión iniciada": token de JWT_EXPIRES_IN_RECORDAR en vez de JWT_EXPIRES_IN.
  recordarme: z.boolean().optional(),
});

export type CredencialesInput = z.infer<typeof credencialesSchema>;

export const crearSecretarioSchema = z.object({
  nombre: z.string().min(1, "El nombre es requerido"),
  email: z.email("Email inválido"),
  password: passwordNueva,
});

export type CrearSecretarioInput = z.infer<typeof crearSecretarioSchema>;

// Mismos campos que el secretario: Administrador tampoco tiene ningún dato
// propio que Usuario no tenga ya.
export const crearAdministradorSchema = crearSecretarioSchema;
export type CrearAdministradorInput = CrearSecretarioInput;

export const cambiarEstadoUsuarioSchema = z.object({
  estado: z.enum(["activo", "inactivo"]),
});
export type CambiarEstadoUsuarioInput = z.infer<typeof cambiarEstadoUsuarioSchema>;

export const olvideContrasenaSchema = z.object({
  email: z.preprocess((v) => (typeof v === "string" ? v.trim().toLowerCase() : v), z.email("Email inválido")),
});

export const restablecerContrasenaSchema = z.object({
  token: z.string().min(1, "Falta el enlace"),
  password: passwordNueva,
});

export const cambiarContrasenaSchema = z.object({
  passwordActual: z.string().min(1, "Ingresá tu contraseña actual"),
  passwordNueva,
});
export type CambiarContrasenaInput = z.infer<typeof cambiarContrasenaSchema>;
