import { Router } from "express";
import { authMiddleware, requireRole } from "../../core/middlewares/authMiddleware";
import type { DocumentoController } from "./documento.controller";

export function documentoRoutes(controller: DocumentoController): Router {
  const router = Router();

  router.get(
    "/alumnos/:alumnoId",
    authMiddleware,
    requireRole("admin", "secretario", "padre"),
    controller.listarPorAlumno,
  );
  router.patch(
    "/alumnos/:alumnoId/cargar",
    authMiddleware,
    requireRole("admin", "secretario", "padre"),
    controller.marcarCargado,
  );
  router.post("/autorizacion-imagen", authMiddleware, requireRole("padre"), controller.autorizarImagen);
  router.get(
    "/alumnos/:alumnoId/autorizacion-imagen",
    authMiddleware,
    requireRole("admin", "secretario", "padre"),
    controller.obtenerAutorizacionImagen,
  );
  router.patch(
    "/alumnos/:alumnoId/autorizacion-imagen/manual",
    authMiddleware,
    requireRole("admin", "secretario"),
    controller.marcarAutorizacionManual,
  );
  router.patch(
    "/alumnos/:alumnoId/autorizacion-imagen/revocar",
    authMiddleware,
    requireRole("admin", "secretario"),
    controller.revocarAutorizacion,
  );

  return router;
}
