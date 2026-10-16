import { useQuery } from "@tanstack/react-query";
import { documentoService } from "../documentoService";

export function useDocumentosFaltantes() {
  return useQuery({ queryKey: ["documentos", "faltantes"], queryFn: documentoService.faltantes });
}
