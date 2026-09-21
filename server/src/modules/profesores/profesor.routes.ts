import { Router } from "express";
import { authMiddleware, requireRole } from "../../core/middlewares/authMiddleware";
import type { ProfesorController } from "./profesor.controller";

export function profesorRoutes(controller: ProfesorController): Router {
  const router = Router();

  router.get("/", authMiddleware, requireRole("admin"), controller.listar);
  router.post("/", authMiddleware, requireRole("admin"), controller.crear);
  router.patch("/:id", authMiddleware, requireRole("admin"), controller.actualizar);

  return router;
}
