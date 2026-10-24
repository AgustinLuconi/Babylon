import type { QueryClient } from "@tanstack/react-query";
import { nombreMes } from "@/core/lib/utils";
import type { Nombres } from "./mensajes";

// Busca un registro por id entre las consultas ya cargadas con ese prefijo (listas o listas dentro de páginas).
function buscar<T extends { id: string }>(queryClient: QueryClient, prefijo: string, id: string): T | null {
  for (const [, datos] of queryClient.getQueriesData<unknown>({ queryKey: [prefijo] })) {
    const lista = Array.isArray(datos) ? datos : [];
    const encontrado = lista.find((x): x is T => typeof x === "object" && x !== null && (x as { id?: unknown }).id === id);
    if (encontrado) return encontrado;
  }
  return null;
}

// Los nombres para el mensaje "quién hizo qué", con lo que el navegador ya tiene: la señal nunca los trae.
export function nombresDesdeLaCache(queryClient: QueryClient): Nombres {
  return {
    alumno: (id) => {
      const a =
        buscar<{ id: string; nombre: string; apellido: string }>(queryClient, "alumnos", id) ??
        buscar<{ id: string; nombre: string; apellido: string }>(queryClient, "cursos", id);
      return a ? `${a.nombre} ${a.apellido}` : null;
    },
    mesDeCuota: (id) => {
      const c = buscar<{ id: string; mes: number }>(queryClient, "cuotas", id);
      return c ? nombreMes(c.mes).toLowerCase() : null;
    },
  };
}
