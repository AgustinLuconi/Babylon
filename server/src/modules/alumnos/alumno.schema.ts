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
} from "../../core/validacion";

// La fecha de nacimiento llega como AAAA-MM-DD y se guarda como medianoche UTC.
const fechaNacimiento = fechaNacimientoSchema.transform((s) => new Date(`${s}T00:00:00.000Z`));

export const nuevoAlumnoSchema = z
  .object({
    nombre: textoRequerido("El nombre", 60),
    apellido: textoRequerido("El apellido", 60),
    dni: dniSchema,
    fechaNacimiento,
    direccion: textoOpcional(150),
    telefono: opcional(celularSchema),
    email: opcional(emailSchema),
    foto: textoOpcional(500),
    observacionesMedicas: textoOpcional(1000),
    padreId: z.string().min(1, "El alumno debe estar asociado a un padre/tutor"),
    cursoId: z.string().optional(),
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
