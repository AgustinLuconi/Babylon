import { Router } from "express";
import { authMiddleware, requireRole } from "../../core/middlewares/authMiddleware";
import type { CalificacionController } from "./calificacion.controller";

export function calificacionRoutes(controller: CalificacionController): Router {
  const router = Router();
  const lectores = requireRole("admin", "secretario", "profesor", "padre");
  const staffYProfesor = requireRole("admin", "secretario", "profesor");

  router.get(
    "/cursos/:cursoId/evaluaciones",
    authMiddleware,
    staffYProfesor,
    controller.listarEvaluacionesPorCurso,
  );
  router.get(
    "/evaluaciones/:id/calificaciones",
    authMiddleware,
    staffYProfesor,
    controller.listarCalificacionesDeEvaluacion,
  );
  router.get(
    "/cursos/:cursoId/notas-cierre",
    authMiddleware,
    staffYProfesor,
    controller.listarNotasCierrePorCurso,
  );

  router.post("/evaluaciones", authMiddleware, requireRole("profesor"), controller.crearEvaluacion);
  router.patch("/evaluaciones/:id/publicar", authMiddleware, requireRole("profesor"), controller.publicarEvaluacion);
  router.post(
    "/evaluaciones/:id/calificaciones",
    authMiddleware,
    requireRole("profesor"),
    controller.cargarCalificaciones,
  );
  // Notas de cierre: se cargan y se publican por lote (todo el curso de una vez).
  router.post("/notas-cierre", authMiddleware, requireRole("profesor"), controller.cargarNotasCierre);
  router.post("/notas-cierre/publicar", authMiddleware, requireRole("profesor"), controller.publicarNotasCierre);

  router.get("/alumnos/:alumnoId", authMiddleware, lectores, controller.listarCalificacionesPorAlumno);
  router.get("/alumnos/:alumnoId/notas-cierre", authMiddleware, lectores, controller.listarNotasCierrePorAlumno);

  return router;
}
