import { Router } from "express";
import { authMiddleware, requireRole } from "../../core/middlewares/authMiddleware";
import type { AsistenciaController } from "./asistencia.controller";

export function asistenciaRoutes(controller: AsistenciaController): Router {
  const router = Router();

  router.post("/masiva", authMiddleware, requireRole("profesor"), controller.registrarMasiva);
  router.post("/sin-clases", authMiddleware, requireRole("profesor"), controller.marcarSinClases);
  router.delete("/sin-clases/:cursoId/:fecha", authMiddleware, requireRole("profesor"), controller.quitarSinClases);
  router.get("/cursos/:cursoId/sin-clases", authMiddleware, requireRole("admin", "secretario", "profesor"), controller.listarSinClasesDeCurso);
  router.get(
    "/alumnos/:alumnoId/sin-clases",
    authMiddleware,
    requireRole("admin", "secretario", "profesor", "padre"),
    controller.listarSinClasesDeAlumno,
  );
  router.get(
    "/alumnos/:alumnoId",
    authMiddleware,
    requireRole("admin", "secretario", "profesor", "padre"),
    controller.listarPorAlumno,
  );

  return router;
}
