import { create } from "zustand";
import type { SenalCambio } from "./types";

// Los mensajes "quién hizo qué" en pantalla. Los cambios iguales (mismo dato, acción y autor) que llegan dentro de 1 s
// se juntan en uno con los ids sumados: un lote de 28 notas publicadas es un solo mensaje.
export interface MensajeDeCambio {
  clave: number;
  cambio: SenalCambio;
  // Hasta cuándo se puede seguir sumando a este mensaje.
  agrupaHasta: number;
}

const AGRUPAR_MS = 1000;
const DURACION_MS = 5000;
const MAXIMO = 3;
let siguiente = 0;

export const useMensajesDeCambiosStore = create<{ mensajes: MensajeDeCambio[] }>(() => ({ mensajes: [] }));

const mismaFuente = (a: SenalCambio, b: SenalCambio) =>
  a.dato === b.dato && a.accion === b.accion && (a.por?.usuarioId ?? null) === (b.por?.usuarioId ?? null);

function sumarIds(a: SenalCambio["ids"], b: SenalCambio["ids"]): SenalCambio["ids"] {
  const suma: SenalCambio["ids"] = { ...a };
  for (const [k, v] of Object.entries(b) as [keyof SenalCambio["ids"], string[] | undefined][]) {
    suma[k] = [...new Set([...(suma[k] ?? []), ...(v ?? [])])];
  }
  return suma;
}

export function mostrarMensajeDeCambio(cambio: SenalCambio): void {
  const ahora = Date.now();
  const { mensajes } = useMensajesDeCambiosStore.getState();
  const abierto = mensajes.find((m) => m.agrupaHasta >= ahora && mismaFuente(m.cambio, cambio));
  if (abierto) {
    useMensajesDeCambiosStore.setState({
      mensajes: mensajes.map((m) =>
        m === abierto ? { ...m, cambio: { ...m.cambio, ids: sumarIds(m.cambio.ids, cambio.ids) }, agrupaHasta: ahora + AGRUPAR_MS } : m,
      ),
    });
    return;
  }
  const nuevo: MensajeDeCambio = { clave: siguiente++, cambio, agrupaHasta: ahora + AGRUPAR_MS };
  useMensajesDeCambiosStore.setState({ mensajes: [...mensajes, nuevo].slice(-MAXIMO) });
  window.setTimeout(() => cerrarMensajeDeCambio(nuevo.clave), DURACION_MS);
}

export function cerrarMensajeDeCambio(clave: number): void {
  useMensajesDeCambiosStore.setState((e) => ({ mensajes: e.mensajes.filter((m) => m.clave !== clave) }));
}
