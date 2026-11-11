import { Router } from "express";
import { authMiddleware, requireRole } from "../../core/middlewares/authMiddleware";
import { limiteLoginPorCuenta, limiteLoginPorIp } from "../../core/middlewares/limitesDePedidos";
import type { UsuarioController } from "./usuario.controller";

export function usuarioRoutes(controller: UsuarioController): Router {
  const router = Router();

  router.post("/login", limiteLoginPorIp, limiteLoginPorCuenta, controller.login);
  router.get("/yo", authMiddleware, controller.yo);
  // Cualquier rol autenticado: cada persona ve y cierra solo sus propias sesiones.
  router.post("/logout", authMiddleware, controller.logout);
  router.get("/sesiones", authMiddleware, controller.listarSesiones);
  router.post("/sesiones/cerrar-otras", authMiddleware, controller.cerrarOtrasSesiones);
  router.delete("/sesiones/:id", authMiddleware, controller.cerrarSesionAjena);
  router.post("/secretarios", authMiddleware, requireRole("admin"), controller.crearSecretario);
  router.post("/administradores", authMiddleware, requireRole("admin"), controller.crearAdministrador);
  router.get("/sin-cuenta", authMiddleware, requireRole("admin"), controller.listarSinCuenta);
  router.post("/cuentas", authMiddleware, requireRole("admin"), controller.crearCuenta);
  router.get("/usuarios/por-email", authMiddleware, requireRole("admin"), controller.buscarPorEmail);
  router.get("/usuarios", authMiddleware, requireRole("admin"), controller.listarUsuarios);
  router.patch("/usuarios/:id", authMiddleware, requireRole("admin"), controller.actualizarCuenta);
  router.patch("/usuarios/:id/estado", authMiddleware, requireRole("admin"), controller.cambiarEstado);

  return router;
}
