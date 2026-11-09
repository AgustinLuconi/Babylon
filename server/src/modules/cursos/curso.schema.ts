import { z } from "zod";
import { borrable, texto, textoOpcional, textoRequerido } from "../../core/validacion";

const horaSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Formato de hora inválido (HH:mm)");

export const horarioInputSchema = z
  .object({
    diaSemana: z.enum(["lunes", "martes", "miercoles", "jueves", "viernes", "sabado"]),
    horaInicio: horaSchema,
    horaFin: horaSchema,
  })
  .strict();

// La hora de fin es posterior a la de inicio, y dos horarios del mismo día no se pisan.
const horariosSchema = z.array(horarioInputSchema).superRefine((horarios, ctx) => {
  horarios.forEach((h, i) => {
    if (h.horaFin <= h.horaInicio) {
      ctx.addIssue({ code: "custom", path: [i, "horaFin"], message: "La hora de fin tiene que ser posterior a la de inicio" });
    }
  });
  horarios.forEach((a, i) => {
    horarios.forEach((b, j) => {
      if (j > i && a.diaSemana === b.diaSemana && a.horaInicio < b.horaFin && b.horaInicio < a.horaFin) {
        ctx.addIssue({ code: "custom", path: [j], message: "Dos horarios del mismo día no pueden pisarse" });
      }
    });
  });
});

const cupoSchema = z
  .number({ error: "El cupo tiene que ser un número" })
  .int("El cupo tiene que ser un número entero")
  .min(1, "El cupo mínimo es 1")
  .max(50, "El cupo máximo es 50");

const nivelSchema = z.enum(["kids", "teens_a1", "teens_a2", "adults_b1", "adults_b2", "cambridge_prep"]);

export const crearCursoSchema = z
  .object({
    nombre: textoRequerido("El nombre", 80),
    nivel: nivelSchema,
    profesorId: z.string().min(1, "El curso debe tener un profesor asignado"),
    // Opcional: si no se manda, el service lo asigna al ciclo activo. Solo se
    // manda explícito al importar cursos de un ciclo histórico (ej. 2025).
    cicloId: z.string().optional(),
    aula: textoOpcional(30),
    cupo: cupoSchema,
    horarios: horariosSchema.default([]),
  })
  .strict();

export type CrearCursoInput = z.infer<typeof crearCursoSchema>;

export const actualizarCursoSchema = z
  .object({
    nombre: textoRequerido("El nombre", 80).optional(),
    nivel: nivelSchema.optional(),
    profesorId: z.string().min(1).optional(),
    aula: borrable(texto(30)),
    cupo: cupoSchema.optional(),
    estado: z.enum(["activo", "inactivo"]).optional(),
    horarios: horariosSchema.optional(),
  })
  .strict();

export type ActualizarCursoInput = z.infer<typeof actualizarCursoSchema>;
