import { useEffect, useId } from "react";
import { create } from "zustand";

// Registro de lo que se está escribiendo y todavía no se guardó, en todo el sistema. Cada formulario o pantalla de
// carga avisa mientras tiene algo sin guardar (`useSinGuardar`); antes de salir de la pantalla se pregunta
// "¿Salir igual?" (ProteccionSinGuardar, la cruz de los modales y el aviso propio del navegador al recargar o cerrar).
interface EstadoSinGuardar {
  activos: Set<string>;
  // La pregunta en pantalla: se resuelve con true ("Salir sin guardar") o false ("Seguir editando").
  pregunta: ((salir: boolean) => void) | null;
}

export const useSinGuardarStore = create<EstadoSinGuardar>(() => ({ activos: new Set(), pregunta: null }));

export function useSinGuardar(activo: boolean): void {
  const id = useId();
  useEffect(() => {
    if (!activo) return;
    useSinGuardarStore.setState((e) => ({ activos: new Set(e.activos).add(id) }));
    return () =>
      useSinGuardarStore.setState((e) => {
        const activos = new Set(e.activos);
        activos.delete(id);
        return { activos };
      });
  }, [activo, id]);
}

export function hayCambiosSinGuardar(): boolean {
  return useSinGuardarStore.getState().activos.size > 0;
}

// Muestra "Tenés cambios sin guardar. ¿Salir igual?" y resuelve true si la persona elige salir.
export function confirmarSalida(): Promise<boolean> {
  return new Promise((resolver) => {
    useSinGuardarStore.setState({
      pregunta: (salir) => {
        useSinGuardarStore.setState({ pregunta: null });
        resolver(salir);
      },
    });
  });
}

// Para cuando una pantalla guarda y enseguida navega sola (por ejemplo, Inscribir alumno): lo escrito ya se guardó,
// así que esa salida no pregunta.
export function descartarCambiosSinGuardar(): void {
  useSinGuardarStore.setState({ activos: new Set() });
}
