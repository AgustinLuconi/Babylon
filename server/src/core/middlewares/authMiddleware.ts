import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { ejecutarComo } from "../autoria";
import { config } from "../config";
import type { Rol, ValidadorDeSesion } from "../ports";

export interface AuthPayload {
  sub: string;
  rol: Rol;
  // Id de la Sesion con la que se inició (claim `sid` del token): identifica "esta sesión".
  sesionId: string;
  // Cuándo vence el token (claim `exp`): la conexión en vivo se corta en ese momento.
  expiraEn: Date | null;
}

declare global {
  namespace Express {
    interface Request {
      auth?: AuthPayload;
    }
  }
}

let validadorDeSesion: ValidadorDeSesion | null = null;

// Lo llama container.ts al arrancar. Sin validador el middleware rechaza todo
// (falla cerrado): nunca acepta un token sin revisar el estado de la cuenta.
export function configurarValidadorDeSesion(validador: ValidadorDeSesion): void {
  validadorDeSesion = validador;
}

export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;

  if (!token) {
    res.status(401).json({ error: "Token no provisto" });
    return;
  }

  let payload: { sub: string; rol: Rol; sid?: string; exp?: number };
  try {
    payload = jwt.verify(token, config.JWT_SECRET) as typeof payload;
  } catch {
    res.status(401).json({ error: "Token inválido o expirado" });
    return;
  }

  if (!validadorDeSesion) {
    throw new Error("authMiddleware: falta configurar el validador de sesión");
  }
  // Sin `sid` (token emitido antes de existir las sesiones), con una sesión cerrada, vencida o de otra cuenta, o con
  // la cuenta desactivada: 401. Es una sola consulta por pedido.
  // `sub` tiene que ser un texto no vacío: un `undefined` en el filtro de la consulta se ignoraría y validaría la
  // sesión de cualquier cuenta.
  if (typeof payload.sub !== "string" || !payload.sub || !payload.sid || !(await validadorDeSesion(payload.sid, payload.sub))) {
    res.status(401).json({ error: "Tu sesión ya no es válida, ingresá de nuevo" });
    return;
  }

  req.auth = { sub: payload.sub, rol: payload.rol, sesionId: payload.sid, expiraEn: payload.exp ? new Date(payload.exp * 1000) : null };
  // Todo lo que corre a partir de acá sabe quién hizo el pedido (core/autoria.ts).
  ejecutarComo({ usuarioId: payload.sub, rol: payload.rol }, next);
}

export function requireRole(...rolesPermitidos: Rol[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.auth || !rolesPermitidos.includes(req.auth.rol)) {
      res.status(403).json({ error: "No tenés permisos para realizar esta acción" });
      return;
    }
    next();
  };
}
