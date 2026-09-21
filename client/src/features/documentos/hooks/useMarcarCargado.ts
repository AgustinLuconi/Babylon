import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { MarcarCargadoInput } from "../types";
import { documentoService } from "../documentoService";

export function useMarcarCargado() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ alumnoId, datos }: { alumnoId: string; datos: MarcarCargadoInput }) =>
      documentoService.marcarCargado(alumnoId, datos),
    onSuccess: (documento) => {
      queryClient.invalidateQueries({ queryKey: ["documentos", documento.alumnoId] });
    },
  });
}
