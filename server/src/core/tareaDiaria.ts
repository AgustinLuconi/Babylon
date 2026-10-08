import { fechaHoraEnArgentina } from "./fechas";

// Hora de Argentina a la que corren las tareas diarias, sin importar en qué región u huso horario esté el servidor.
const HORA_DE_CORRIDA = 3;
const UN_DIA_MS = 24 * 60 * 60 * 1000;

// Milisegundos desde `ahora` hasta la próxima ocurrencia de HORA_DE_CORRIDA:00 (hora de Argentina). Argentina no usa
// horario de verano, así que el día dura siempre 24 h y alcanza con restar sobre el reloj civil.
export function msHastaProximaCorrida(ahora: Date = new Date()): number {
  const { hora, minuto, segundo } = fechaHoraEnArgentina(ahora);
  const transcurridoDelDia = ((hora * 60 + minuto) * 60 + segundo) * 1000 + ahora.getMilliseconds();
  const espera = HORA_DE_CORRIDA * 60 * 60 * 1000 - transcurridoDelDia;
  return espera > 0 ? espera : espera + UN_DIA_MS;
}

// Corre `tarea` al arrancar y después una vez por día, a las 03:00 de Argentina. Cada tarea maneja sus propios
// errores: una que falla se registra con su nombre y no impide que corran las demás ni la del día siguiente.
export function programarTareaDiaria(nombre: string, tarea: () => Promise<void>): void {
  const correr = async () => {
    try {
      await tarea();
    } catch (error) {
      console.error(`[${nombre}] falló la tarea diaria:`, error);
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
