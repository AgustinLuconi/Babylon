import { Router } from "express";
import { authMiddleware, requireRole } from "../../core/middlewares/authMiddleware";
import type { AlumnoController } from "./alumno.controller";

export function alumnoRoutes(controller: AlumnoController): Router {
  const router = Router();

  router.get("/", authMiddleware, requireRole("admin", "secretario"), controller.listar);
  router.get("/incompletos", authMiddleware, requireRole("admin", "secretario"), controller.incompletos);
  router.get("/mios", authMiddleware, requireRole("padre"), controller.misHijos);
  router.post("/", authMiddleware, requireRole("admin", "secretario"), controller.inscribir);
  router.get("/:id/historial-cursos", authMiddleware, requireRole("admin", "secretario", "padre"), controller.historialDeCursos);
  router.patch("/:id", authMiddleware, requireRole("admin", "secretario"), controller.actualizar);
  router.put("/:id/responsable", authMiddleware, requireRole("admin", "secretario"), controller.asignarResponsable);

  return router;
}
