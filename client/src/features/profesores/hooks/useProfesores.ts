import { useQuery } from "@tanstack/react-query";
import { profesorService } from "../profesorService";

export function useProfesores() {
  return useQuery({
    queryKey: ["profesores"],
    queryFn: profesorService.listar,
  });
}
