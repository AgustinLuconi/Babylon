import { Router } from "express";
import { authMiddleware, requireRole } from "../../core/middlewares/authMiddleware";
import type { ConfiguracionController } from "./configuracion.controller";

export function configuracionRoutes(controller: ConfiguracionController): Router {
  const router = Router();

  router.get("/", authMiddleware, requireRole("admin", "secretario"), controller.obtener);
  router.patch("/", authMiddleware, requireRole("admin"), controller.actualizar);

  return router;
}
