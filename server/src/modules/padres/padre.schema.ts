import { z } from "zod";

export const crearPadreSchema = z.object({
  nombre: z.string().min(1, "El nombre es requerido"),
  apellido: z.string().min(1, "El apellido es requerido"),
  dni: z.string().min(1, "El DNI es requerido"),
  telefono: z.string().optional(),
  email: z.email("Email inválido"),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
  vinculo: z.enum(["padre", "madre", "tutor"]),
});

export type CrearPadreInput = z.infer<typeof crearPadreSchema>;

// Usado solo por el importador de datos históricos (ej. ciclo 2025): la
// planilla real no trae el email del padre/madre/tutor, así que se crea el
// registro sin cuenta de acceso — sin email no se puede armar un Usuario
// (login) real, y no vamos a inventar uno.
export const crearPadreSinCuentaSchema = z.object({
  nombre: z.string().min(1, "El nombre es requerido"),
  apellido: z.string().min(1, "El apellido es requerido"),
  dni: z.string().min(1, "El DNI es requerido"),
  direccion: z.string().optional(),
  telefono: z.string().optional(),
  vinculo: z.enum(["padre", "madre", "tutor"]),
});

export type CrearPadreSinCuentaInput = z.infer<typeof crearPadreSinCuentaSchema>;

export const actualizarPadreSchema = z.object({
  nombre: z.string().min(1).optional(),
  apellido: z.string().min(1).optional(),
  direccion: z.string().optional(),
  telefono: z.string().optional(),
  email: z.email("Email inválido").optional(),
  vinculo: z.enum(["padre", "madre", "tutor"]).optional(),
});

export type ActualizarPadreInput = z.infer<typeof actualizarPadreSchema>;
