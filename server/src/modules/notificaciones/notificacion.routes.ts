import { Router } from "express";
import { authMiddleware } from "../../core/middlewares/authMiddleware";
import type { NotificacionController } from "./notificacion.controller";

// Todos los roles autenticados; cada uno trabaja solo con sus avisos (cuenta + rol de la sesión).
export function notificacionRoutes(controller: NotificacionController): Router {
  const router = Router();
  router.get("/", authMiddleware, controller.campana);
  router.get("/historial", authMiddleware, controller.historial);
  router.post("/leer-todas", authMiddleware, controller.leerTodas);
  router.post("/:id/leida", authMiddleware, controller.marcarLeida);
  router.get("/preferencias", authMiddleware, controller.preferencias);
  router.patch("/preferencias/:tipo", authMiddleware, controller.cambiarPreferencia);
  return router;
}
