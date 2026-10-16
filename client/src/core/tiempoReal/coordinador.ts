import { conectarEnVivo } from "./conexion";
import type { SenalEnVivo } from "./lectorSse";

const nombre = (sid: string) => `babylon-tiempo-real:${sid}`;

// Una sola conexión por sesión aunque haya varias pestañas: la pestaña que obtiene el candado (Web Locks) la mantiene y
// reparte lo que llega a las demás por BroadcastChannel; si se cierra, otra toma el candado sola. El candado y el canal
// llevan el id de la sesión: dos cuentas abiertas en el mismo navegador nunca comparten señales, y BroadcastChannel no
// sale del mismo sitio. Sin esas APIs (navegadores viejos), cada pestaña abre su propia conexión.
export function iniciarTiempoReal(sid: string, token: string, alSenal: (senal: SenalEnVivo) => void): () => void {
  if (!("locks" in navigator) || typeof BroadcastChannel === "undefined") return conectarEnVivo(token, alSenal);

  const canal = new BroadcastChannel(nombre(sid));
  canal.onmessage = (e: MessageEvent<SenalEnVivo>) => alSenal(e.data);
  const salir = new AbortController();
  navigator.locks
    .request(nombre(sid), { signal: salir.signal }, () =>
      new Promise<void>((liberar) => {
        // El candado se puede conceder justo después de que la pestaña se fue (por ejemplo, el doble montaje de React
        // en desarrollo): en ese caso se suelta enseguida, sin abrir nada.
        if (salir.signal.aborted) return liberar();
        const cortar = conectarEnVivo(token, (senal) => {
          alSenal(senal);
          if (!salir.signal.aborted) canal.postMessage(senal);
        });
        salir.signal.addEventListener("abort", () => {
          cortar();
          liberar();
        });
      }),
    )
    .catch(() => {
      // AbortError: la pestaña se fue antes de obtener el candado.
    });
  return () => {
    salir.abort();
    canal.close();
  };
}

// Se cerró la sesión desde esta pestaña: las demás pestañas de la misma sesión se enteran por el canal.
export function avisarCierreLocal(sid: string): void {
  if (typeof BroadcastChannel === "undefined") return;
  const canal = new BroadcastChannel(nombre(sid));
  const senal: SenalEnVivo = { tipo: "sesion-cerrada", datos: { motivo: "cerrada-por-el-usuario" } };
  canal.postMessage(senal);
  canal.close();
}
