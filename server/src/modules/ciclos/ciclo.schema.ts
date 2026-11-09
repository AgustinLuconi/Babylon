import { z } from "zod";

export const crearCicloSchema = z
  .object({
    anio: z.number({ error: "El año tiene que ser un número" }).int().min(2000, "El año mínimo es 2000").max(2100, "El año máximo es 2100"),
  })
  .strict();

export type CrearCicloInput = z.infer<typeof crearCicloSchema>;
