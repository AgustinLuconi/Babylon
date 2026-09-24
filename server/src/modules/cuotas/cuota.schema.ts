import { z } from "zod";

export const registrarPagoSchema = z.object({
  cuotaIds: z.array(z.string().min(1)).min(1, "Debe indicar al menos una cuota a pagar"),
  metodo: z.enum(["efectivo", "transferencia", "tarjeta", "mercadopago", "otro"]),
  // AAAA-MM-DD. Si no viene, se toma el momento actual. No puede ser futura.
  fechaPago: z.iso.date().optional(),
  notas: z.string().trim().max(200, "Máximo 200 caracteres").optional(),
});

export type RegistrarPagoBody = z.infer<typeof registrarPagoSchema>;

// registradoPor nunca viaja en el body: lo agrega el controller a partir del
// usuario autenticado (JWT), para que no se pueda falsear quién cobró.
export interface RegistrarPagoInput extends RegistrarPagoBody {
  registradoPor: string;
}
