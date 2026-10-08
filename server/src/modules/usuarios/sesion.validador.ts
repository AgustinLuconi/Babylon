import type { ValidadorDeSesion } from "../../core/ports";
import { MIN_ENTRE_REGISTROS_DE_USO_MS } from "./sesion.entity";
import type { SesionRepository } from "./sesion.repository";

// Validador que inyecta container.ts en authMiddleware. `reloj` existe para poder fijar la hora en las verificaciones.
//
// Además de validar, registra el último uso de la sesión, pero sin escribir en cada pedido: la consulta de validación
// ya trae `ultimoUsoEn`, y solo si pasaron 5 minutos se lanza una actualización condicional que NO se espera (no suma
// tiempo al pedido; si dos pedidos coinciden, solo uno escribe). Una sesión sin uso no escribe nada.
export function crearValidadorDeSesion(sesionRepo: SesionRepository, reloj: () => Date = () => new Date()): ValidadorDeSesion {
  return async (sesionId, usuarioId) => {
    const ahora = reloj();
    const sesion = await sesionRepo.buscarValida(sesionId, usuarioId, ahora);
    if (!sesion) return false;

    if (ahora.getTime() - sesion.ultimoUsoEn.getTime() >= MIN_ENTRE_REGISTROS_DE_USO_MS) {
      const antesDe = new Date(ahora.getTime() - MIN_ENTRE_REGISTROS_DE_USO_MS);
      void sesionRepo
        .registrarUso(sesionId, ahora, antesDe)
        .catch((error) => console.error("[sesiones] no se pudo registrar el último uso:", error));
    }
    return true;
  };
}
