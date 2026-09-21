import { z } from "zod";

export const crearCicloSchema = z.object({
  anio: z.number().int().min(2000).max(2100),
});

export type CrearCicloInput = z.infer<typeof crearCicloSchema>;
