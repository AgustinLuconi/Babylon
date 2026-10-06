import type { Request, Response } from "express";
import { ipKeyGenerator, rateLimit } from "express-rate-limit";

// Límites de pedidos por IP, en memoria del proceso: alcanzan con un solo
// servidor. Con varias instancias habría que pasarlos a un almacén compartido.
const QUINCE_MINUTOS = 15 * 60 * 1000;

function responderDemasiados(_req: Request, res: Response) {
  res.status(429).json({ error: "Demasiados intentos, probá de nuevo en unos minutos" });
}

function emailDelPedido(req: Request): string {
  const email = (req.body as { email?: unknown } | undefined)?.email;
  return typeof email === "string" ? email.trim().toLowerCase() : "";
}

const base = { windowMs: QUINCE_MINUTOS, standardHeaders: "draft-8" as const, legacyHeaders: false, handler: responderDemasiados };

// Fuerza bruta contra una cuenta: la clave combina IP y email, así un padre
// que se equivoca no bloquea a otro que comparte su red (wifi, CGNAT).
export const limiteLoginPorCuenta = rateLimit({
  ...base,
  limit: 5,
  skipSuccessfulRequests: true,
  keyGenerator: (req) => `${ipKeyGenerator(req.ip ?? "")}|${emailDelPedido(req)}`,
});

// Techo general contra quien prueba muchas cuentas desde una IP.
export const limiteLoginPorIp = rateLimit({ ...base, limit: 20, skipSuccessfulRequests: true });

export const limiteOlvideContrasena = rateLimit({ ...base, limit: 5 });
export const limiteRestablecerContrasena = rateLimit({ ...base, limit: 5 });
