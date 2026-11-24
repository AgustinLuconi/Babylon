import { z } from "zod";

export const actualizarConfiguracionSchema = z
  .object({
    valorCuota: z
      .number({ error: "El valor de la cuota tiene que ser un número" })
      .positive("El valor de la cuota debe ser mayor a cero")
      .max(10_000_000, "Valor demasiado alto")
      .optional(),
    diaVencimiento: z
      .number({ error: "El día de vencimiento tiene que estar entre 1 y 28" })
      .int("El día de vencimiento tiene que estar entre 1 y 28")
      .min(1, "El día de vencimiento tiene que estar entre 1 y 28")
      .max(28, "El día de vencimiento tiene que estar entre 1 y 28")
      .optional(),
  })
  .strict()
  .refine((datos) => datos.valorCuota !== undefined || datos.diaVencimiento !== undefined, "No hay nada para guardar");

export type ActualizarConfiguracionInput = z.infer<typeof actualizarConfiguracionSchema>;
