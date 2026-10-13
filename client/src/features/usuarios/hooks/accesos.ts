import type { QueryClient } from "@tanstack/react-query";

// El server acepta hasta 100 personas por pedido, pero los correos salen durante el pedido: se manda en tandas cortas
// (que no choquen con el tiempo máximo de un proxy) y el resumen final las suma.
export const TAMANO_TANDA = 20;

// Invitar, reenviar o cancelar cambia Pendientes y, con eso, las cuentas y los vínculos de padres y profesores.
export function invalidarAccesos(queryClient: QueryClient) {
  for (const clave of ["pendientes", "usuarios", "padres", "profesores"]) {
    void queryClient.invalidateQueries({ queryKey: [clave] });
  }
}
