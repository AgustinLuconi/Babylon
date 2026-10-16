import { useMutation, useQueryClient } from "@tanstack/react-query";
import { calificacionService } from "../calificacionService";
import type { CargarNotaCierreInput, NotaCierre } from "../types";

// Las notas de cierre de todo el curso se guardan en un solo pedido (todo o nada).
export function useCargarNotasCierre() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (registros: CargarNotaCierreInput[]): Promise<NotaCierre[]> => calificacionService.cargarNotasCierre(registros),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calificaciones"] });
    },
  });
}
