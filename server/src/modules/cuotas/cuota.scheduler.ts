import type { CuotaService } from "./cuota.service";

// Hora local del servidor a la que corre la tarea diaria.
const HORA_DE_CORRIDA = 3;

// Milisegundos desde `ahora` hasta la próxima ocurrencia de HORA_DE_CORRIDA:00.
export function msHastaProximaCorrida(ahora: Date = new Date()): number {
  const proxima = new Date(ahora);
  proxima.setHours(HORA_DE_CORRIDA, 0, 0, 0);
  if (proxima.getTime() <= ahora.getTime()) proxima.setDate(proxima.getDate() + 1);
  return proxima.getTime() - ahora.getTime();
}

// Tarea de cuotas: corre al arrancar y luego una vez por día, a las 03:00.
// No depende de que sea día 1 o día 11: mira el estado (cuotas pendientes ya
// vencidas, alumnos sin cuota del mes), así que el día 1 crea las del mes, el
// día 11 marca las vencidas y el resto de los días no cambia nada. Si el servidor
// estuvo apagado en esas fechas, la corrida de arranque lo pone al día.
export function iniciarMantenimientoDeCuotas(cuotaService: CuotaService): void {
  const correr = async () => {
    try {
      const { vencidas, generadas } = await cuotaService.mantenerCuotas();
      if (vencidas > 0 || generadas > 0) {
        console.log(`[cuotas] ${generadas} generada(s), ${vencidas} pasada(s) a vencida`);
      }
    } catch (error) {
      console.error("[cuotas] falló el mantenimiento:", error);
    }
  };

  const programarSiguiente = () => {
    setTimeout(async () => {
      await correr();
      programarSiguiente();
    }, msHastaProximaCorrida()).unref();
  };

  void correr();
  programarSiguiente();
}
