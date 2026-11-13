import { z } from "zod";
import { borrable, celularSchema, dniSchema, emailSchema, opcional, textoRequerido } from "../../core/validacion";

export const crearProfesorSchema = z
  .object({
    nombre: textoRequerido("El nombre", 60),
    apellido: textoRequerido("El apellido", 60),
    dni: dniSchema,
    telefono: opcional(celularSchema),
    email: emailSchema,
  })
  .strict();

export type CrearProfesorInput = z.infer<typeof crearProfesorSchema>;

// Edición parcial (PATCH): cualquier subconjunto de campos. El email solo
// cambia el login real si el profesor ya tiene cuenta (usuarioId).
export const actualizarProfesorSchema = z
  .object({
    nombre: textoRequerido("El nombre", 60).optional(),
    apellido: textoRequerido("El apellido", 60).optional(),
    dni: dniSchema.optional(),
    telefono: borrable(celularSchema),
    email: emailSchema.optional(),
    estado: z.enum(["activo", "inactivo"]).optional(),
  })
  .strict();

export type ActualizarProfesorInput = z.infer<typeof actualizarProfesorSchema>;

// Usado solo por el importador de datos históricos: la fuente 2025 no trae
// ni DNI ni email real de los profesores (solo nombre y apellido) — se crea
// sin cuenta de acceso hasta conseguir esos datos reales. No se expone por HTTP.
export const crearProfesorSinCuentaSchema = z.object({
  nombre: z.string().min(1, "El nombre es requerido"),
  apellido: z.string().optional(),
  telefono: z.string().optional(),
});

export type CrearProfesorSinCuentaInput = z.infer<typeof crearProfesorSinCuentaSchema>;
