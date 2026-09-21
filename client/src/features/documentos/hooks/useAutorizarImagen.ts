import { useMutation, useQueryClient } from "@tanstack/react-query";
import { documentoService } from "../documentoService";

export function useAutorizarImagen() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: documentoService.autorizarImagen,
    onSuccess: (documento) => {
      queryClient.invalidateQueries({ queryKey: ["autorizacionImagen", documento.alumnoId] });
      queryClient.invalidateQueries({ queryKey: ["documentos", documento.alumnoId] });
    },
  });
}
