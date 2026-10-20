import { create } from "zustand";

// ¿La página abierta es de una versión vieja del sistema? Se compara con la versión del client publicada
// (/version.json) y con la del servidor (la trae la señal `listo` de la conexión en vivo). Una versión nueva primero
// solo avisa (franja); después de guardar algo con éxito, o al ir a otra pantalla, exige recargar.
interface EstadoVersion {
  estado: "al-dia" | "nueva";
  bloqueo: boolean;
}

export const useVersionStore = create<EstadoVersion>(() => ({ estado: "al-dia", bloqueo: false }));

// La primera versión del servidor que ve esta página es la de referencia.
let versionDelServidor: string | null = null;

const marcarNueva = () => useVersionStore.setState({ estado: "nueva" });

export async function comprobarVersion(versionServidor?: string): Promise<void> {
  if (versionServidor) {
    if (versionDelServidor === null) versionDelServidor = versionServidor;
    else if (versionDelServidor !== versionServidor) marcarNueva();
  }
  try {
    const respuesta = await fetch(`/version.json?t=${Date.now()}`, { cache: "no-store" });
    if (!respuesta.ok) return;
    const { version } = (await respuesta.json()) as { version?: string };
    if (version && version !== __VERSION_CLIENT__) marcarNueva();
  } catch {
    // Sin conexión: se vuelve a comprobar en la próxima reconexión.
  }
}

export function hayVersionNueva(): boolean {
  return useVersionStore.getState().estado === "nueva";
}

// Después de guardar algo con éxito (lo que se estaba haciendo ya terminó), una versión nueva exige recargar.
export function alGuardarConExito(): void {
  if (hayVersionNueva()) useVersionStore.setState({ bloqueo: true });
}

export function recargar(): void {
  window.location.reload();
}
