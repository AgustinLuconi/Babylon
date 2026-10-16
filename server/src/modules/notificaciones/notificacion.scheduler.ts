import { programarTareaDiaria, programarTareaPeriodica } from "../../core/tareaDiaria";
import type { NotificacionService } from "./notificacion.service";

const QUINCE_MINUTOS = 15 * 60 * 1000;

// Red de seguridad de los avisos: al arrancar y a las 03:00, revisión completa de todos los tipos de estado (incluye lo
// que depende del calendario: cuotas por vencer, evaluaciones de la semana, asistencia de hace más de 7 días) y
// limpieza de los avisos de más de 30 días. Cada 15 minutos, la asistencia pendiente (una clase que acaba de empezar).
export function iniciarAvisosPeriodicos(avisos: NotificacionService): void {
  programarTareaDiaria("avisos", async () => {
    await avisos.sincronizarTodo();
    const borrados = await avisos.limpiar();
    if (borrados > 0) console.log(`[avisos] ${borrados} avisos de más de 30 días borrados`);
  });
  programarTareaPeriodica("asistencia-pendiente", QUINCE_MINUTOS, () => avisos.sincronizarAsistencia());
}
