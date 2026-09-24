import { z } from "zod";

export const actualizarConfiguracionSchema = z.object({
  valorCuota: z.number().positive("El valor de la cuota debe ser mayor a cero").max(10_000_000, "Valor demasiado alto"),
});

export type ActualizarConfiguracionInput = z.infer<typeof actualizarConfiguracionSchema>;
