import { useQuery } from "@tanstack/react-query";
import { documentoService } from "../documentoService";

export function useAutorizacionImagen(alumnoId: string | undefined) {
  return useQuery({
    queryKey: ["autorizacionImagen", alumnoId],
    queryFn: () => documentoService.obtenerAutorizacionImagen(alumnoId as string),
    enabled: alumnoId !== undefined,
  });
}
