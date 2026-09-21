import { Router } from "express";
import { authMiddleware, requireRole } from "../../core/middlewares/authMiddleware";
import type { ChatController } from "./chat.controller";

export function chatRoutes(controller: ChatController): Router {
  const router = Router();
  const participantes = requireRole("admin", "secretario", "padre");

  router.get("/", authMiddleware, requireRole("admin", "secretario"), controller.listar);
  router.get("/mio", authMiddleware, requireRole("padre"), controller.miChat);
  router.get("/:id/mensajes", authMiddleware, participantes, controller.listarMensajes);
  router.post("/:id/mensajes", authMiddleware, participantes, controller.enviarMensaje);

  return router;
}
