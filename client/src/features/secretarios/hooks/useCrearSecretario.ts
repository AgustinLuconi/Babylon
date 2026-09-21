import { useMutation, useQueryClient } from "@tanstack/react-query";
import { secretarioService } from "../secretarioService";

export function useCrearSecretario() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: secretarioService.crear,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["usuarios"] });
    },
  });
}
