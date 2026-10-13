import type { QueryClient } from "@tanstack/react-query";

// El server acepta hasta 100 personas por pedido: un lote más grande se manda en tandas.
export const TAMANO_TANDA = 100;

// Invitar, reenviar o cancelar cambia Pendientes y, con eso, las cuentas y los vínculos de padres y profesores.
export function invalidarAccesos(queryClient: QueryClient) {
  for (const clave of ["pendientes", "usuarios", "padres", "profesores"]) {
    void queryClient.invalidateQueries({ queryKey: [clave] });
  }
}
