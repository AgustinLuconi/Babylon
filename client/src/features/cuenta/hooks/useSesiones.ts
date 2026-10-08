import { useQuery } from "@tanstack/react-query";
import { cuentaService } from "../cuentaService";

export function useSesiones() {
  // Sin refetchOnWindowFocus: cada pedido de la lista cuenta como uso de la sesión actual en el servidor (una escritura),
  // y debería ocurrir porque la persona entró a la pantalla, no cada vez que vuelve a enfocar la ventana.
  return useQuery({ queryKey: ["sesiones"], queryFn: cuentaService.listarSesiones, refetchOnWindowFocus: false });
}
