import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config";
import type { Rol, ValidadorDeSesion } from "../ports";

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

  let payload: AuthPayload & { iat?: number };
  try {
    payload = jwt.verify(token, config.JWT_SECRET) as AuthPayload & { iat?: number };
  } catch {
    res.status(401).json({ error: "Token inválido o expirado" });
    return;
  }

  if (!validadorDeSesion) {
    throw new Error("authMiddleware: falta configurar el validador de sesión");
  }
  // Una cuenta desactivada, o cuya contraseña cambió después de emitido el
  // token, pierde la sesión en el próximo pedido aunque el token no haya vencido.
  // `iat` está en segundos: se compara contra el segundo del cambio, así un
  // login hecho en el mismo segundo que el cambio sigue siendo válido.
  const estado = await validadorDeSesion(payload.sub);
  const cambioEnSegundos = estado?.contrasenaCambiadaEn ? Math.floor(estado.contrasenaCambiadaEn.getTime() / 1000) : null;
  const emitidoAntesDelCambio = cambioEnSegundos !== null && (payload.iat ?? 0) < cambioEnSegundos;
  if (!estado || !estado.activo || emitidoAntesDelCambio) {
    res.status(401).json({ error: "Tu sesión ya no es válida, ingresá de nuevo" });
    return;
  }

  req.auth = { sub: payload.sub, rol: payload.rol };
  next();
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
