import { useMutation, useQueryClient } from "@tanstack/react-query";
import { padreService } from "../padreService";

export function useCrearPadre() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: padreService.crear,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["padres"] });
      queryClient.invalidateQueries({ queryKey: ["usuarios"] });
    },
  });
}
