import { z } from "zod";

export const actualizarConfiguracionSchema = z
  .object({
    valorCuota: z
      .number({ error: "El valor de la cuota tiene que ser un número" })
      .positive("El valor de la cuota debe ser mayor a cero")
      .max(10_000_000, "Valor demasiado alto"),
  })
  .strict();

export type ActualizarConfiguracionInput = z.infer<typeof actualizarConfiguracionSchema>;
