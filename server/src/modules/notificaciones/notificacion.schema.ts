import { z } from "zod";
import type { TipoNotificacion } from "./notificacion.entity";
import { TIPOS } from "./notificacion.tipos";

// Todos los tipos del catálogo (derivado de él: un tipo nuevo no puede quedar fuera del pedido de preferencias).
export const tipoNotificacionSchema = z.enum(Object.keys(TIPOS) as [TipoNotificacion, ...TipoNotificacion[]]);

export const historialSchema = z.object({
  filtro: z.enum(["todas", "no-leidas", "pendientes"]).default("todas"),
  despuesDe: z.string().min(1).optional(),
});

export const preferenciaSchema = z.object({ activa: z.boolean() });
