import { useMutation, useQueryClient } from "@tanstack/react-query";
import { calificacionService } from "../calificacionService";
import type { CargarNotaCierreInput, NotaCierre } from "../types";

// A diferencia de las calificaciones de una evaluación, CargarNotaCierre no
// tiene conflicto posible (siempre hace upsert), así que no hace falta
// atomicidad tipo UnitOfWork acá: cada alumno es un POST independiente.
export function useCargarNotasCierre() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (registros: CargarNotaCierreInput[]): Promise<NotaCierre[]> =>
      Promise.all(registros.map((r) => calificacionService.cargarNotaCierre(r))),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calificaciones"] });
    },
  });
}
