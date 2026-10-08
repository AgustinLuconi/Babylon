import { programarTareaDiaria } from "../../core/tareaDiaria";
import type { CuotaService } from "./cuota.service";

// Mantenimiento de cuotas: corre al arrancar y una vez por día a las 03:00 de Argentina (ver core/tareaDiaria.ts). No
// depende de que sea día 1 o día 11: mira el estado (cuotas pendientes ya vencidas, alumnos sin cuota del mes), así que el
// día 1 crea las del mes, el día 11 marca las vencidas y el resto de los días no cambia nada. Si el servidor estuvo
// apagado en esas fechas, la corrida de arranque lo pone al día.
export function iniciarMantenimientoDeCuotas(cuotaService: CuotaService): void {
  programarTareaDiaria("cuotas", async () => {
    const { vencidas, generadas } = await cuotaService.mantenerCuotas();
    if (vencidas > 0 || generadas > 0) {
      console.log(`[cuotas] ${generadas} generada(s), ${vencidas} pasada(s) a vencida`);
    }
  });
}
