import { useMutation, useQueryClient } from "@tanstack/react-query";
import { cicloService } from "../cicloService";
import type { EditarFechasInput } from "../types";

export function useEditarFechasDelCiclo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ cicloId, datos }: { cicloId: string; datos: EditarFechasInput }) => cicloService.editarFechas(cicloId, datos),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ciclos"] }),
  });
}
