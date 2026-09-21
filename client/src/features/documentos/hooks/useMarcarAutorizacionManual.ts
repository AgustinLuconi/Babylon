import { useMutation, useQueryClient } from "@tanstack/react-query";
import { documentoService } from "../documentoService";

export function useMarcarAutorizacionManual() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: documentoService.marcarAutorizacionManual,
    onSuccess: (documento) => {
      queryClient.invalidateQueries({ queryKey: ["autorizacionImagen", documento.alumnoId] });
      queryClient.invalidateQueries({ queryKey: ["documentos", documento.alumnoId] });
    },
  });
}
