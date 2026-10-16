import { API_URL } from "@/core/lib/apiClient";
import { crearLectorSse, type SenalEnVivo } from "./lectorSse";

const ESPERAS_MS = [1000, 2000, 4000, 8000, 16000, 30000];

// Abre la conexión en vivo con fetch y la mantiene. No usa EventSource: no deja mandar el encabezado Authorization, y
// poner el token en la dirección lo dejaría en los registros. Si se corta, la vuelve a abrir esperando cada vez más
// (1, 2, 4… hasta 30 s, más un azar de hasta 1 s para que todos no reintenten a la vez). No reintenta si el servidor
// rechaza la sesión (avisa con la señal "rechazo"), si la cerraron ("sesion-cerrada") o si la reemplazó otra conexión
// de la misma sesión ("reemplazada").
export function conectarEnVivo(token: string, alSenal: (senal: SenalEnVivo) => void): () => void {
  let terminada = false;
  let intento = 0;
  let control: AbortController | null = null;
  let espera: number | undefined;

  const recibir = (senal: SenalEnVivo) => {
    if (senal.tipo === "listo") intento = 0;
    if (senal.tipo === "sesion-cerrada" || senal.tipo === "reemplazada") terminada = true;
    // Un error de quien recibe la señal no corta la conexión.
    try {
      alSenal(senal);
    } catch (error) {
      console.error("[tiempo real] falló una señal:", error);
    }
  };

  const reintentar = () => {
    if (terminada) return;
    const base = ESPERAS_MS[Math.min(intento, ESPERAS_MS.length - 1)];
    intento++;
    espera = window.setTimeout(() => void abrir(), base + Math.random() * 1000);
  };

  const abrir = async () => {
    if (terminada) return;
    control = new AbortController();
    try {
      const res = await fetch(`${API_URL}/api/tiempo-real`, {
        headers: { Authorization: `Bearer ${token}`, Accept: "text/event-stream" },
        cache: "no-store",
        signal: control.signal,
      });
      if (res.status === 401) {
        terminada = true;
        alSenal({ tipo: "rechazo", datos: {} });
        return;
      }
      if (res.ok && res.body) {
        const lector = res.body.pipeThrough(new TextDecoderStream()).getReader();
        const procesar = crearLectorSse(recibir);
        for (;;) {
          const { value, done } = await lector.read();
          if (done) break;
          procesar(value);
        }
      }
    } catch {
      // Red caída, servidor reiniciándose o conexión cortada al salir: se reintenta (salvo que haya terminado).
    }
    reintentar();
  };

  void abrir();
  return () => {
    terminada = true;
    window.clearTimeout(espera);
    control?.abort();
  };
}
