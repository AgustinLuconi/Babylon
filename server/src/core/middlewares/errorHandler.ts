import type { NextFunction, Request, Response } from "express";
import { ZodError, z } from "zod";
import { DomainError, ValidationError } from "../errors";

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    // Por campo de primer nivel y, para lo anidado, también por ruta completa ("responsable.datos.telefono").
    const porRuta: Record<string, string[]> = {};
    for (const issue of err.issues) {
      if (issue.path.length > 1) (porRuta[issue.path.join(".")] ??= []).push(issue.message);
    }
    res.status(400).json({ error: "Datos inválidos", details: { ...z.flattenError(err).fieldErrors, ...porRuta } });
    return;
  }

  if (err instanceof ValidationError) {
    res.status(err.statusCode).json({ error: err.message, details: err.details });
    return;
  }

  if (err instanceof DomainError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }

  // Un cuerpo que no es JSON (o demasiado grande): lo rechaza el lector de cuerpos con su propio estado 4xx.
  const { status, type } = err as { status?: unknown; type?: unknown };
  if (typeof status === "number" && status >= 400 && status < 500 && typeof type === "string" && type.startsWith("entity.")) {
    res.status(status).json({ error: status === 413 ? "El pedido es demasiado grande" : "El pedido no tiene un formato válido" });
    return;
  }

  console.error(err);
  res.status(500).json({ error: "Error interno del servidor" });
}
