import { z } from "zod";

const rolSchema = z.enum(["admin", "secretario", "profesor", "padre"]);

export const credencialesSchema = z.object({
  email: z.email("Email inválido"),
  password: z.string().min(1, "La contraseña es requerida"),
  // Solo se necesita cuando la cuenta tiene más de un rol habilitado y ya se
  // sabe con cuál se quiere entrar (segundo paso del login).
  rolElegido: rolSchema.optional(),
});

export type CredencialesInput = z.infer<typeof credencialesSchema>;

export const crearSecretarioSchema = z.object({
  nombre: z.string().min(1, "El nombre es requerido"),
  email: z.email("Email inválido"),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
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
