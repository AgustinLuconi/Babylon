import { Router } from "express";
import { authMiddleware, requireRole } from "../../core/middlewares/authMiddleware";
import { limiteLoginPorCuenta, limiteLoginPorIp } from "../../core/middlewares/limitesDePedidos";
import type { UsuarioController } from "./usuario.controller";

export function usuarioRoutes(controller: UsuarioController): Router {
  const router = Router();

  router.post("/login", limiteLoginPorIp, limiteLoginPorCuenta, controller.login);
  router.post("/secretarios", authMiddleware, requireRole("admin"), controller.crearSecretario);
  router.post("/administradores", authMiddleware, requireRole("admin"), controller.crearAdministrador);
  router.get("/usuarios", authMiddleware, requireRole("admin"), controller.listarUsuarios);
  router.patch("/usuarios/:id/estado", authMiddleware, requireRole("admin"), controller.cambiarEstado);

  return router;
}
