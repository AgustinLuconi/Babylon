import { useMutation } from "@tanstack/react-query";
import { cuentaService } from "../cuentaService";

export function useEnviarVerificacion() {
  return useMutation({ mutationFn: cuentaService.enviarVerificacion });
}
