import { z } from "zod";
import {
  borrable,
  celularSchema,
  dniSchema,
  emailSchema,
  fechaNacimientoSchema,
  opcional,
  texto,
  textoOpcional,
  textoRequerido,
  passwordNueva,
} from "../../core/validacion";
import { datosDeFichaSchema, MENSAJE_PASSWORD_SIN_EMAIL, sinContrasenaSinEmail } from "../padres/padre.schema";

// La fecha de nacimiento llega como AAAA-MM-DD y se guarda como medianoche UTC.
const fechaNacimiento = fechaNacimientoSchema.transform((s) => new Date(`${s}T00:00:00.000Z`));

const vinculoDeOtraPersona = z.enum(["padre", "madre", "tutor"], { error: "Elegí el vínculo con el alumno" });

// Quién es el responsable del alumno: una ficha que ya existe, una ficha nueva (nombre, apellido y celular alcanzan) o el
// propio alumno (un adulto): en ese caso la ficha se arma con sus mismos datos.
export const responsableSchema = z.discriminatedUnion("tipo", [
  z.object({ tipo: z.literal("existente"), padreId: z.string().min(1), vinculo: vinculoDeOtraPersona }).strict(),
  z.object({ tipo: z.literal("nuevo"), vinculo: vinculoDeOtraPersona, datos: datosDeFichaSchema }).strict(),
  z
    .object({
      tipo: z.literal("propio"),
      telefono: celularSchema,
      email: opcional(emailSchema),
      password: passwordNueva.optional(),
    })
    .strict()
    .refine(sinContrasenaSinEmail, MENSAJE_PASSWORD_SIN_EMAIL),
]);

export type ResponsableInput = z.infer<typeof responsableSchema>;

// Lo mínimo para inscribir: nombre, apellido, curso y responsable. Todo lo demás se completa después.
export const nuevoAlumnoSchema = z
  .object({
    nombre: textoRequerido("El nombre", 60),
    apellido: textoRequerido("El apellido", 60),
    cursoId: z.string({ error: "El curso es requerido" }).min(1, "El curso es requerido"),
    responsable: responsableSchema,
    dni: opcional(dniSchema),
    fechaNacimiento: opcional(fechaNacimiento),
    direccion: textoOpcional(150),
    telefono: opcional(celularSchema),
    email: opcional(emailSchema),
    foto: textoOpcional(500),
    observacionesMedicas: textoOpcional(1000),
  })
  .strict();

export type NuevoAlumnoInput = z.infer<typeof nuevoAlumnoSchema>;

// Edición parcial: ausente = no se toca; null (o vacío) = se borra, solo en lo que se puede completar después.
export const actualizarAlumnoSchema = z
  .object({
    nombre: textoRequerido("El nombre", 60).optional(),
    apellido: textoRequerido("El apellido", 60).optional(),
    dni: borrable(dniSchema),
    fechaNacimiento: borrable(fechaNacimiento),
    direccion: borrable(texto(150)),
    telefono: borrable(celularSchema),
    email: borrable(emailSchema),
    observacionesMedicas: borrable(texto(1000)),
    cursoId: z.string().min(1).optional(),
    estado: z.enum(["activo", "inactivo", "egresado"]).optional(),
  })
  .strict();

export type ActualizarAlumnoInput = z.infer<typeof actualizarAlumnoSchema>;
