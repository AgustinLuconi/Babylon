import { z } from "zod";
import { passwordNueva } from "../../core/validacion";

const MAX_POR_PEDIDO = 100;
const listaDeIds = z.array(z.string().min(1)).max(MAX_POR_PEDIDO, `Se pueden enviar hasta ${MAX_POR_PEDIDO} invitaciones por vez`);

export const invitarSchema = z
  .object({ padreIds: listaDeIds.default([]), profesorIds: listaDeIds.default([]) })
  .refine((d) => d.padreIds.length + d.profesorIds.length > 0, { message: "Elegí al menos una persona" })
  .refine((d) => d.padreIds.length + d.profesorIds.length <= MAX_POR_PEDIDO, {
    message: `Se pueden enviar hasta ${MAX_POR_PEDIDO} invitaciones por vez`,
  });

export const reenviarSchema = z.object({
  usuarioIds: listaDeIds.min(1, "Elegí al menos una persona"),
});

export const tokenInvitacionSchema = z.object({ token: z.string().min(1, "Falta el enlace") });

export const activarCuentaSchema = z.object({
  token: z.string().min(1, "Falta el enlace"),
  password: passwordNueva,
});
