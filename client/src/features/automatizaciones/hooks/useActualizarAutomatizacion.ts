import { useMutation, useQueryClient } from "@tanstack/react-query";
import { automatizacionService } from "../automatizacionService";
import type { ActualizarAutomatizacionInput, ReglaId } from "../types";

export function useActualizarAutomatizacion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ regla, cambios }: { regla: ReglaId; cambios: ActualizarAutomatizacionInput }) => automatizacionService.actualizar(regla, cambios),
    // Cambiar una regla recalcula sus alertas: se vuelve a pedir la lista y el historial.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["automatizaciones"] }),
  });
}
