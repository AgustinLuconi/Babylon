import { Router } from "express";
import { authMiddleware, requireRole } from "../../core/middlewares/authMiddleware";
import type { CursoController } from "./curso.controller";

export function cursoRoutes(controller: CursoController): Router {
  const router = Router();

  router.get("/", authMiddleware, requireRole("admin", "secretario", "profesor"), controller.listar);
  router.post("/", authMiddleware, requireRole("admin"), controller.crear);
  router.get(
    "/horarios",
    authMiddleware,
    requireRole("admin", "secretario", "profesor"),
    controller.listarHorarios,
  );
  router.patch("/:id", authMiddleware, requireRole("admin"), controller.actualizar);
  router.get(
    "/:id/alumnos",
    authMiddleware,
    requireRole("admin", "secretario", "profesor"),
    controller.listarAlumnos,
  );

  return router;
}
