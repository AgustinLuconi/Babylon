import { Router } from "express";
import { authMiddleware, requireRole } from "../../core/middlewares/authMiddleware";
import type { ReporteController } from "./reporte.controller";

export function reporteRoutes(controller: ReporteController): Router {
  const router = Router();

  router.get(
    "/dashboard",
    authMiddleware,
    requireRole("admin", "secretario"),
    controller.obtenerResumenDashboard,
  );
  router.get(
    "/alumnos",
    authMiddleware,
    requireRole("admin", "secretario"),
    controller.listarReporteAlumnos,
  );

  return router;
}
