import { z } from "zod";
import { borrable, celularSchema, dniSchema, emailSchema, opcional, passwordNueva, texto, textoOpcional, textoRequerido } from "../../core/validacion";

// Lo mínimo de una ficha de responsable: nombre, apellido y celular. DNI, email y dirección se completan después.
// Con email se crea la cuenta (con contraseña, activa; sin ella, pendiente + invitación); sin email, no hay cuenta.
const sinContrasenaSinEmail = (d: { password?: string; email?: string }) => !d.password || d.email !== undefined;
const MENSAJE_PASSWORD_SIN_EMAIL = { message: "Para asignar una contraseña hace falta un email", path: ["email"] };

export const datosDeFichaSchema = z
  .object({
    nombre: textoRequerido("El nombre", 60),
    apellido: textoRequerido("El apellido", 60),
    telefono: celularSchema,
    dni: opcional(dniSchema),
    email: opcional(emailSchema),
    direccion: textoOpcional(150),
    password: passwordNueva.optional(),
  })
  .strict()
  .refine(sinContrasenaSinEmail, MENSAJE_PASSWORD_SIN_EMAIL);

export type DatosDeFichaInput = z.infer<typeof datosDeFichaSchema>;

export const crearPadreSchema = datosDeFichaSchema;
export type CrearPadreInput = DatosDeFichaInput;
export { sinContrasenaSinEmail, MENSAJE_PASSWORD_SIN_EMAIL };

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
