import { z } from "zod";

export const nuevoAlumnoSchema = z.object({
  nombre: z.string().min(1, "El nombre es requerido"),
  apellido: z.string().min(1, "El apellido es requerido"),
  dni: z.string().min(1, "El DNI es requerido"),
  fechaNacimiento: z.coerce.date(),
  direccion: z.string().optional(),
  telefono: z.string().optional(),
  email: z.string().email().optional(),
  foto: z.string().optional(),
  observacionesMedicas: z.string().optional(),
  padreId: z.string().min(1, "El alumno debe estar asociado a un padre/tutor"),
  cursoId: z.string().optional(),
});

export type NuevoAlumnoInput = z.infer<typeof nuevoAlumnoSchema>;

export const actualizarAlumnoSchema = z.object({
  nombre: z.string().min(1).optional(),
  apellido: z.string().min(1).optional(),
  fechaNacimiento: z.coerce.date().optional(),
  direccion: z.string().optional(),
  telefono: z.string().optional(),
  email: z.string().email().optional(),
  observacionesMedicas: z.string().optional(),
  cursoId: z.string().optional(),
  estado: z.enum(["activo", "inactivo", "egresado"]).optional(),
});

export type ActualizarAlumnoInput = z.infer<typeof actualizarAlumnoSchema>;
