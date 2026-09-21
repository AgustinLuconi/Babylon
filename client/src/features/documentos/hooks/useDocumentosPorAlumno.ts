import { useQuery } from "@tanstack/react-query";
import { documentoService } from "../documentoService";

export function useDocumentosPorAlumno(alumnoId: string | undefined) {
  return useQuery({
    queryKey: ["documentos", alumnoId],
    queryFn: () => documentoService.listarPorAlumno(alumnoId as string),
    enabled: alumnoId !== undefined,
  });
}
