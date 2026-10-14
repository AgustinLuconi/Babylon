import { z } from "zod";
import { passwordNueva } from "../../core/validacion";

export const crearProfesorSchema = z.object({
  nombre: z.string().min(1, "El nombre es requerido"),
  apellido: z.string().min(1, "El apellido es requerido"),
  dni: z.string().min(1, "El DNI es requerido"),
  telefono: z.string().optional(),
  email: z.email("Email inválido"),
  // Sin contraseña, la cuenta se crea pendiente y se manda una invitación por email.
  password: passwordNueva.optional(),
});

export type CrearProfesorInput = z.infer<typeof crearProfesorSchema>;

// Edición parcial (PATCH): cualquier subconjunto de campos. El email solo
// cambia el login real si el profesor ya tiene cuenta (usuarioId).
export const actualizarProfesorSchema = z.object({
  nombre: z.string().min(1, "El nombre es requerido").optional(),
  apellido: z.string().min(1, "El apellido es requerido").optional(),
  dni: z.string().min(1, "El DNI es requerido").optional(),
  telefono: z.string().optional(),
  email: z.email("Email inválido").optional(),
  estado: z.enum(["activo", "inactivo"]).optional(),
});

export type ActualizarProfesorInput = z.infer<typeof actualizarProfesorSchema>;

// Usado solo por el importador de datos históricos: la fuente 2025 no trae
// ni DNI ni email real de los profesores (solo nombre y apellido) — se crea
// sin cuenta de acceso hasta conseguir esos datos reales.
export const crearProfesorSinCuentaSchema = z.object({
  nombre: z.string().min(1, "El nombre es requerido"),
  apellido: z.string().optional(),
  telefono: z.string().optional(),
});

export type CrearProfesorSinCuentaInput = z.infer<typeof crearProfesorSinCuentaSchema>;
