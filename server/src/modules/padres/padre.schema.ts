import { z } from "zod";
import { borrable, celularSchema, dniSchema, emailSchema, opcional, passwordNueva, texto, textoRequerido } from "../../core/validacion";

export const crearPadreSchema = z
  .object({
    nombre: textoRequerido("El nombre", 60),
    apellido: textoRequerido("El apellido", 60),
    dni: dniSchema,
    telefono: opcional(celularSchema),
    email: emailSchema,
    // Sin contraseña, la cuenta se crea pendiente y se manda una invitación por email.
    password: passwordNueva.optional(),
  })
  .strict();

export type CrearPadreInput = z.infer<typeof crearPadreSchema>;

// Usado solo por el importador de datos históricos (ej. ciclo 2025): la
// planilla real no trae el email del padre/madre/tutor, así que se crea el
// registro sin cuenta de acceso — sin email no se puede armar un Usuario
// (login) real, y no vamos a inventar uno. No se expone por HTTP.
export const crearPadreSinCuentaSchema = z.object({
  nombre: z.string().min(1, "El nombre es requerido"),
  apellido: z.string().min(1, "El apellido es requerido"),
  dni: z.string().min(1, "El DNI es requerido"),
  direccion: z.string().optional(),
  telefono: z.string().optional(),
});

export type CrearPadreSinCuentaInput = z.infer<typeof crearPadreSinCuentaSchema>;

// Edición parcial. El teléfono es obligatorio al crear y no se puede borrar; lo demás que se completa después, sí.
export const actualizarPadreSchema = z
  .object({
    nombre: textoRequerido("El nombre", 60).optional(),
    apellido: textoRequerido("El apellido", 60).optional(),
    dni: borrable(dniSchema),
    direccion: borrable(texto(150)),
    telefono: celularSchema.optional(),
    email: borrable(emailSchema),
  })
  .strict();

export type ActualizarPadreInput = z.infer<typeof actualizarPadreSchema>;
