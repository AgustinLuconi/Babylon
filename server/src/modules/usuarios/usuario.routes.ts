import { Router } from "express";
import { authMiddleware, requireRole } from "../../core/middlewares/authMiddleware";
import {
  limiteCambioContrasena,
  limiteLoginPorCuenta,
  limiteLoginPorIp,
  limiteOlvideContrasena,
  limiteRestablecerContrasena,
  limiteVerificarEmail,
} from "../../core/middlewares/limitesDePedidos";
import type { UsuarioController } from "./usuario.controller";

export function usuarioRoutes(controller: UsuarioController): Router {
  const router = Router();

  router.post("/login", limiteLoginPorIp, limiteLoginPorCuenta, controller.login);
  router.post("/olvide-contrasena", limiteOlvideContrasena, controller.olvideContrasena);
  router.post("/restablecer-contrasena", limiteRestablecerContrasena, controller.restablecerContrasena);
  router.post("/verificar-email", limiteVerificarEmail, controller.verificarEmail);
  router.get("/yo", authMiddleware, controller.yo);
  router.post("/enviar-verificacion", authMiddleware, controller.enviarVerificacion);
  // Cualquier rol autenticado: cada persona ve y cierra solo sus propias sesiones.
  router.post("/cambiar-contrasena", authMiddleware, limiteCambioContrasena, controller.cambiarContrasena);
  router.post("/logout", authMiddleware, controller.logout);
  router.get("/sesiones", authMiddleware, controller.listarSesiones);
  router.post("/sesiones/cerrar-otras", authMiddleware, controller.cerrarOtrasSesiones);
  router.delete("/sesiones/:id", authMiddleware, controller.cerrarSesionAjena);
  router.post("/secretarios", authMiddleware, requireRole("admin"), controller.crearSecretario);
  router.post("/administradores", authMiddleware, requireRole("admin"), controller.crearAdministrador);
  router.get("/usuarios", authMiddleware, requireRole("admin"), controller.listarUsuarios);
  router.patch("/usuarios/:id/estado", authMiddleware, requireRole("admin"), controller.cambiarEstado);

  return router;
}
