// Junta varias señales seguidas en una sola recarga: espera a que pasen `espera` ms sin señales, pero nunca más de
// `maximo` ms desde la primera pendiente (con señales que no paran, la pantalla igual se pone al día).
export function crearProgramador(fn: () => void, espera: number, maximo: number) {
  let temporizador: ReturnType<typeof setTimeout> | undefined;
  let primera: number | null = null;
  const correr = () => {
    primera = null;
    fn();
  };
  return {
    programar() {
      const ahora = Date.now();
      if (primera === null) primera = ahora;
      clearTimeout(temporizador);
      temporizador = setTimeout(correr, Math.min(espera, Math.max(0, primera + maximo - ahora)));
    },
    cancelar() {
      clearTimeout(temporizador);
      primera = null;
    },
  };
}
