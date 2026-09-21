import { Router } from "express";
import { authMiddleware, requireRole } from "../../core/middlewares/authMiddleware";
import type { AsistenciaController } from "./asistencia.controller";

export function asistenciaRoutes(controller: AsistenciaController): Router {
  const router = Router();

  router.post("/masiva", authMiddleware, requireRole("profesor"), controller.registrarMasiva);
  router.get(
    "/alumnos/:alumnoId",
    authMiddleware,
    requireRole("admin", "secretario", "profesor", "padre"),
    controller.listarPorAlumno,
  );

  return router;
}
