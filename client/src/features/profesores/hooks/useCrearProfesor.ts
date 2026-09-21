import { useMutation, useQueryClient } from "@tanstack/react-query";
import { profesorService } from "../profesorService";

export function useCrearProfesor() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: profesorService.crear,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profesores"] });
      queryClient.invalidateQueries({ queryKey: ["usuarios"] });
    },
  });
}
