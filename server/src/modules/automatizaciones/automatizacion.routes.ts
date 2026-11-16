import { Router } from "express";
import { authMiddleware, requireRole } from "../../core/middlewares/authMiddleware";
import type { AutomatizacionController } from "./automatizacion.controller";

// El panel de Automatizaciones es solo de administración.
export function automatizacionRoutes(controller: AutomatizacionController): Router {
  const router = Router();

  router.get("/", authMiddleware, requireRole("admin"), controller.listar);
  router.patch("/:regla", authMiddleware, requireRole("admin"), controller.actualizar);
  router.get("/:regla/alertas", authMiddleware, requireRole("admin"), controller.historial);

  return router;
}
