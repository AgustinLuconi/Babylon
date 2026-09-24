import type { CuotaService } from "./cuota.service";

const CADA_HORA_MS = 60 * 60 * 1000;

// Tarea periódica de cuotas: corre al arrancar y luego cada hora. Es idempotente,
// así que si el servidor estuvo apagado el día 1 se pone al día en cuanto vuelve
// a levantar; no depende de que un proceso externo la dispare.
export function iniciarMantenimientoDeCuotas(cuotaService: CuotaService): void {
  const correr = async () => {
    try {
      const { vencidas, generadas } = await cuotaService.mantenerCuotas();
      if (vencidas > 0 || generadas > 0) {
        console.log(`[cuotas] ${generadas} generada(s), ${vencidas} pasada(s) a vencida`);
      }
    } catch (error) {
      console.error("[cuotas] falló el mantenimiento periódico:", error);
    }
  };

  void correr();
  setInterval(correr, CADA_HORA_MS).unref();
}
