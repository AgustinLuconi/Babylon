import { Router } from "express";
import { authMiddleware, requireRole } from "../../core/middlewares/authMiddleware";
import type { PadreController } from "./padre.controller";

export function padreRoutes(controller: PadreController): Router {
  const router = Router();

  router.get("/", authMiddleware, requireRole("admin", "secretario"), controller.listar);
  router.post("/", authMiddleware, requireRole("admin", "secretario"), controller.crear);
  router.patch("/:id", authMiddleware, requireRole("admin", "secretario"), controller.actualizar);

  return router;
}
