import type { QueryClient } from "@tanstack/react-query";

// El server acepta hasta 100 personas por pedido, pero los correos salen durante el pedido: se manda en tandas cortas
// (que no choquen con el tiempo máximo de un proxy) y el resumen final las suma.
export const TAMANO_TANDA = 20;

// Motivo con el que se informa lo que no se pudo enviar porque una tanda falló (error de red, servidor caído…).
export const MOTIVO_CORTE = "se cortó el envío (revisá la lista antes de reintentar)";

// Invitar, reenviar o cancelar cambia Pendientes y, con eso, las cuentas y los vínculos de padres y profesores.
export function invalidarAccesos(queryClient: QueryClient) {
  for (const clave of ["pendientes", "usuarios", "padres", "profesores"]) {
    void queryClient.invalidateQueries({ queryKey: [clave] });
  }
}
