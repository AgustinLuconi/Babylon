import { useMutation, useQueryClient } from "@tanstack/react-query";
import { asistenciaService } from "../asistenciaService";

export function useQuitarSinClases() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ cursoId, fecha }: { cursoId: string; fecha: string }) => asistenciaService.quitarSinClases(cursoId, fecha),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["asistencia"] }),
  });
}
