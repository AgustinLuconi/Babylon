import { z } from "zod";
import { fechaCalendario, textoRequerido } from "../../core/validacion";

export const crearCicloSchema = z
  .object({
    anio: z.number({ error: "El año tiene que ser un número" }).int().min(2000, "El año mínimo es 2000").max(2100, "El año máximo es 2100"),
  })
  .strict();

export type CrearCicloInput = z.infer<typeof crearCicloSchema>;

const dia = (mensaje: string) => fechaCalendario(mensaje).transform((f) => f.toISOString().slice(0, 10));
const tipoDePausa = z.enum(["receso", "feriado", "otro"], { error: "El tipo de pausa no es válido" });

export const editarFechasSchema = z
  .object({ inicio: dia("La fecha de inicio no es válida"), fin: dia("La fecha de fin no es válida") })
  .strict();

export const crearPausaSchema = z
  .object({ desde: dia("La fecha de inicio de la pausa no es válida"), hasta: dia("La fecha de fin de la pausa no es válida"), nombre: textoRequerido("El nombre", 80), tipo: tipoDePausa })
  .strict();

export const editarPausaSchema = z
  .object({ desde: dia("La fecha de inicio de la pausa no es válida"), hasta: dia("La fecha de fin de la pausa no es válida"), nombre: textoRequerido("El nombre", 80), tipo: tipoDePausa })
  .partial()
  .strict();

export type EditarFechasInput = z.infer<typeof editarFechasSchema>;
export type CrearPausaInput = z.infer<typeof crearPausaSchema>;
export type EditarPausaInput = z.infer<typeof editarPausaSchema>;
