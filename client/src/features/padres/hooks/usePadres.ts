import { useQuery } from "@tanstack/react-query";
import { padreService } from "../padreService";

export function usePadres() {
  return useQuery({
    queryKey: ["padres"],
    queryFn: padreService.listar,
  });
}
