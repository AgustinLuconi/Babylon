import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config";
import type { Rol } from "../ports";

export interface AuthPayload {
  sub: string;
  rol: Rol;
}

declare global {
  namespace Express {
    interface Request {
      auth?: AuthPayload;
    }
  }
}

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;

  if (!token) {
    res.status(401).json({ error: "Token no provisto" });
    return;
  }

  try {
    req.auth = jwt.verify(token, config.JWT_SECRET) as AuthPayload;
    next();
  } catch {
    res.status(401).json({ error: "Token inválido o expirado" });
  }
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
