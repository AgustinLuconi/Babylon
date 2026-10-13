import { Router } from "express";
import { authMiddleware, requireRole } from "../../core/middlewares/authMiddleware";
import { limiteActivarCuenta, limiteConsultarInvitacion } from "../../core/middlewares/limitesDePedidos";
import type { InvitacionController } from "./invitacion.controller";

// Montado en /api/auth, junto a las rutas de usuario.routes.ts.
export function invitacionRoutes(controller: InvitacionController): Router {
  const router = Router();

  // Públicas: el enlace del correo es la única credencial (el token va en el cuerpo, nunca en la URL de la API).
  router.post("/activar-cuenta/consultar", limiteConsultarInvitacion, controller.consultar);
  router.post("/activar-cuenta", limiteActivarCuenta, controller.activar);

  router.get("/pendientes", authMiddleware, requireRole("admin"), controller.listarPendientes);
  router.post("/invitaciones", authMiddleware, requireRole("admin"), controller.invitar);
  router.post("/invitaciones/reenviar", authMiddleware, requireRole("admin"), controller.reenviar);
  router.delete("/invitaciones/:usuarioId", authMiddleware, requireRole("admin"), controller.cancelar);

  return router;
}
