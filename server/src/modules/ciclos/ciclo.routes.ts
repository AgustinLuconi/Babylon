import { Router } from "express";
import { authMiddleware, requireRole } from "../../core/middlewares/authMiddleware";
import type { CicloController } from "./ciclo.controller";

export function cicloRoutes(controller: CicloController): Router {
  const router = Router();

  router.get("/", authMiddleware, requireRole("admin", "secretario", "profesor"), controller.listar);
  router.post("/", authMiddleware, requireRole("admin"), controller.crear);
  router.patch("/:id/activar", authMiddleware, requireRole("admin"), controller.marcarActivo);

  return router;
}
