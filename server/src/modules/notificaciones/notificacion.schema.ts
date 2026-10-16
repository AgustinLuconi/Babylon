import { z } from "zod";

export const tipoNotificacionSchema = z.enum([
  "cuotas_vencidas",
  "documentacion_pendiente",
  "evaluacion_proxima",
  "asistencia_pendiente",
  "notas_sin_publicar",
  "cierre_sin_publicar",
  "cuota",
  "documentacion_hijo",
  "nota_publicada",
  "cierre_publicado",
  "observacion_nueva",
]);

export const historialSchema = z.object({
  filtro: z.enum(["todas", "no-leidas", "pendientes"]).default("todas"),
  despuesDe: z.string().min(1).optional(),
});

export const preferenciaSchema = z.object({ activa: z.boolean() });
