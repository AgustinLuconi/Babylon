import { Router } from "express";
import { authMiddleware, requireRole } from "../../core/middlewares/authMiddleware";
import type { ChatController } from "./chat.controller";

export function chatRoutes(controller: ChatController): Router {
  const router = Router();
  const participantes = requireRole("admin", "secretario", "padre");
  const instituto = requireRole("admin", "secretario");

  router.get("/", authMiddleware, instituto, controller.listar);
  router.post("/", authMiddleware, instituto, controller.iniciar);
  router.get("/mio", authMiddleware, requireRole("padre"), controller.miChat);
  router.get("/no-leidos", authMiddleware, participantes, controller.noLeidos);
  router.get("/:id/mensajes", authMiddleware, participantes, controller.listarMensajes);
  router.post("/:id/mensajes", authMiddleware, participantes, controller.enviarMensaje);
  router.post("/:id/leido", authMiddleware, participantes, controller.marcarLeido);

  return router;
}
