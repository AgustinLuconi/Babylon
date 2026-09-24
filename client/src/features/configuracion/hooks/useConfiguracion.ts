import { useQuery } from "@tanstack/react-query";
import { configuracionService } from "../configuracionService";

export function useConfiguracion() {
  return useQuery({ queryKey: ["configuracion"], queryFn: configuracionService.obtener });
}
