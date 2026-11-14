import { Router } from "express";
import { authMiddleware, requireRole } from "../../core/middlewares/authMiddleware";
import type { CicloController } from "./ciclo.controller";
import type { PaseDeAnioController } from "./paseDeAnio.controller";

export function cicloRoutes(controller: CicloController, paseDeAnio: PaseDeAnioController): Router {
  const router = Router();

  router.get("/", authMiddleware, requireRole("admin", "secretario", "profesor"), controller.listar);
  router.post("/", authMiddleware, requireRole("admin"), controller.crear);
  router.post("/pase-de-anio/vista-previa", authMiddleware, requireRole("admin"), paseDeAnio.vistaPrevia);
  router.post("/pase-de-anio/confirmar", authMiddleware, requireRole("admin"), paseDeAnio.confirmar);
  router.patch("/:id/activar", authMiddleware, requireRole("admin"), controller.marcarActivo);
  router.patch("/:id/bloquear", authMiddleware, requireRole("admin"), controller.bloquear);
  router.patch("/:id/desbloquear", authMiddleware, requireRole("admin"), controller.desbloquear);

  return router;
}
