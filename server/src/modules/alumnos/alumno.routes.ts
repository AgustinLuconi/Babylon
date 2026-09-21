import { Router } from "express";
import { authMiddleware, requireRole } from "../../core/middlewares/authMiddleware";
import type { AlumnoController } from "./alumno.controller";

export function alumnoRoutes(controller: AlumnoController): Router {
  const router = Router();

  router.get("/", authMiddleware, requireRole("admin", "secretario"), controller.listar);
  router.get("/mios", authMiddleware, requireRole("padre"), controller.misHijos);
  router.post("/", authMiddleware, requireRole("admin", "secretario"), controller.inscribir);
  router.patch("/:id", authMiddleware, requireRole("admin", "secretario"), controller.actualizar);

  return router;
}
