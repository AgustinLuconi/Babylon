import { Router } from "express";
import { authMiddleware, requireRole } from "../../core/middlewares/authMiddleware";
import type { ObservacionController } from "./observacion.controller";

export function observacionRoutes(controller: ObservacionController): Router {
  const router = Router();

  router.post("/", authMiddleware, requireRole("admin", "secretario", "profesor"), controller.crear);
  router.get(
    "/alumnos/:alumnoId",
    authMiddleware,
    requireRole("admin", "secretario", "profesor", "padre"),
    controller.listarPorAlumno,
  );
  router.post(
    "/categorias",
    authMiddleware,
    requireRole("profesor"),
    controller.crearCategoriaPersonalizada,
  );
  router.get(
    "/cursos/:cursoId/categorias",
    authMiddleware,
    requireRole("admin", "secretario", "profesor"),
    controller.listarCategoriasPersonalizadas,
  );

  return router;
}
