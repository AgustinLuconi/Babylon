import { z } from "zod";

// El rango del número depende de la regla: lo valida el service con el catálogo.
export const actualizarAutomatizacionSchema = z
  .object({
    activa: z.boolean({ error: "El interruptor tiene que ser verdadero o falso" }).optional(),
    umbral: z.number({ error: "El número tiene que ser un número" }).int("El número tiene que ser entero").optional(),
  })
  .strict()
  .refine((d) => d.activa !== undefined || d.umbral !== undefined, { message: "Indicá qué querés cambiar: el interruptor o el número" });

export type ActualizarAutomatizacionInput = z.infer<typeof actualizarAutomatizacionSchema>;

export const historialDeAutomatizacionSchema = z.object({ pagina: z.coerce.number({ error: "La página tiene que ser un número" }).int().min(1, "La página empieza en 1").default(1) });
