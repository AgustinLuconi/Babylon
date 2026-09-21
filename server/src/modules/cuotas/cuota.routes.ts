import { Router } from "express";
import { authMiddleware, requireRole } from "../../core/middlewares/authMiddleware";
import type { CuotaController } from "./cuota.controller";

export function cuotaRoutes(controller: CuotaController): Router {
  const router = Router();

  router.get("/", authMiddleware, requireRole("admin", "secretario"), controller.listarTodas);
  router.get("/pagos", authMiddleware, requireRole("admin", "secretario"), controller.listarPagos);
  router.get(
    "/alumnos/:alumnoId",
    authMiddleware,
    requireRole("admin", "secretario", "padre"),
    controller.listarPorAlumno,
  );
  router.post("/pagos", authMiddleware, requireRole("admin", "secretario"), controller.registrarPago);

  return router;
}
