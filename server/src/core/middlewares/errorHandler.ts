import type { NextFunction, Request, Response } from "express";
import { ZodError, z } from "zod";
import { DomainError, ValidationError } from "../errors";

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    res.status(400).json({ error: "Datos inválidos", details: z.flattenError(err).fieldErrors });
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

  console.error(err);
  res.status(500).json({ error: "Error interno del servidor" });
}
