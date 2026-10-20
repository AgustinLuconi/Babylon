import { create } from "zustand";

// Los últimos cambios hechos por otras personas, por tipo de dato (lo anota features/cambios al recibir la señal).
// Lo usan el resaltado de lo que cambió (core/hooks) y los avisos de la nómina del profesor: así distinguen un cambio
// ajeno, recién llegado, de lo que la persona hizo ella misma o de la primera carga de la pantalla.
export interface CambioAjeno {
  en: number;
  accion: string;
  por: { usuarioId: string; nombre: string; rol: string } | null;
  ids: Record<string, string[] | undefined>;
}

interface EstadoCambios {
  ultimos: Record<string, CambioAjeno | undefined>;
}

export const useCambiosEnVivoStore = create<EstadoCambios>(() => ({ ultimos: {} }));

export function registrarCambioAjeno(dato: string, cambio: Omit<CambioAjeno, "en">): void {
  useCambiosEnVivoStore.setState((e) => ({ ultimos: { ...e.ultimos, [dato]: { ...cambio, en: Date.now() } } }));
}

export function huboCambioAjenoReciente(datos: readonly string[], ms = 3000): boolean {
  const { ultimos } = useCambiosEnVivoStore.getState();
  return datos.some((d) => {
    const c = ultimos[d];
    return c !== undefined && Date.now() - c.en <= ms;
  });
}

export function ultimoCambioAjeno(dato: string): CambioAjeno | undefined {
  return useCambiosEnVivoStore.getState().ultimos[dato];
}
