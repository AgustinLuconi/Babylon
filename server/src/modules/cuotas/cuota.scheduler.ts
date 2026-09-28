import { fechaHoraEnArgentina } from "../../core/fechas";
import type { CuotaService } from "./cuota.service";

// Hora de Argentina a la que corre la tarea diaria, sin importar en qué región u
// huso horario esté el servidor.
const HORA_DE_CORRIDA = 3;
const UN_DIA_MS = 24 * 60 * 60 * 1000;

// Milisegundos desde `ahora` hasta la próxima ocurrencia de HORA_DE_CORRIDA:00
// (hora de Argentina). Argentina no usa horario de verano, así que el día dura
// siempre 24 h y alcanza con restar sobre el reloj civil.
export function msHastaProximaCorrida(ahora: Date = new Date()): number {
  const { hora, minuto, segundo } = fechaHoraEnArgentina(ahora);
  const transcurridoDelDia = ((hora * 60 + minuto) * 60 + segundo) * 1000 + ahora.getMilliseconds();
  const espera = HORA_DE_CORRIDA * 60 * 60 * 1000 - transcurridoDelDia;
  return espera > 0 ? espera : espera + UN_DIA_MS;
}

// Tarea de cuotas: corre al arrancar y luego una vez por día, a las 03:00 de
// Argentina. No depende de que sea día 1 o día 11: mira el estado (cuotas
// pendientes ya vencidas, alumnos sin cuota del mes), así que el día 1 crea las
// del mes, el día 11 marca las vencidas y el resto de los días no cambia nada. Si
// el servidor estuvo apagado en esas fechas, la corrida de arranque lo pone al día.
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
