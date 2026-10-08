import type { ValidadorDeSesion } from "../../core/ports";
import type { SesionRepository } from "./sesion.repository";

// Validador que inyecta container.ts en authMiddleware. `reloj` existe para poder fijar la hora en las verificaciones.
export function crearValidadorDeSesion(sesionRepo: SesionRepository, reloj: () => Date = () => new Date()): ValidadorDeSesion {
  return async (sesionId, usuarioId) => {
    const sesion = await sesionRepo.buscarValida(sesionId, usuarioId, reloj());
    return sesion !== null;
  };
}
