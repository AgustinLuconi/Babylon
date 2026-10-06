import { Router } from "express";
import { authMiddleware } from "../../core/middlewares/authMiddleware";
import type { NotificacionController } from "./notificacion.controller";

export function notificacionRoutes(controller: NotificacionController): Router {
  const router = Router();
  // Todos los roles autenticados; cada uno recibe solo lo suyo (ver controller).
  router.get("/", authMiddleware, controller.listar);
  return router;
}
