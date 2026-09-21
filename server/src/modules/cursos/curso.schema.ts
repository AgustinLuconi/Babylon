import { z } from "zod";

const horaSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Formato de hora inválido (HH:mm)");

export const horarioInputSchema = z.object({
  diaSemana: z.enum(["lunes", "martes", "miercoles", "jueves", "viernes", "sabado"]),
  horaInicio: horaSchema,
  horaFin: horaSchema,
});

export const crearCursoSchema = z.object({
  nombre: z.string().min(1, "El nombre es requerido"),
  nivel: z.enum(["kids", "teens_a1", "teens_a2", "adults_b1", "adults_b2", "cambridge_prep"]),
  profesorId: z.string().min(1, "El curso debe tener un profesor asignado"),
  // Opcional: si no se manda, el service lo asigna al ciclo activo. Solo se
  // manda explícito al importar cursos de un ciclo histórico (ej. 2025).
  cicloId: z.string().optional(),
  aula: z.string().optional(),
  cupo: z.number().int().positive(),
  horarios: z.array(horarioInputSchema).default([]),
});

export type CrearCursoInput = z.infer<typeof crearCursoSchema>;

export const actualizarCursoSchema = z.object({
  nombre: z.string().min(1).optional(),
  nivel: z.enum(["kids", "teens_a1", "teens_a2", "adults_b1", "adults_b2", "cambridge_prep"]).optional(),
  profesorId: z.string().min(1).optional(),
  aula: z.string().optional(),
  cupo: z.number().int().positive().optional(),
  estado: z.enum(["activo", "inactivo"]).optional(),
  horarios: z.array(horarioInputSchema).optional(),
});

export type ActualizarCursoInput = z.infer<typeof actualizarCursoSchema>;
