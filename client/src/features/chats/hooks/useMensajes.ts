import { useMemo } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { chatService } from "../chatService";

// La conversación de a páginas: primero los últimos 50 y, a pedido, los anteriores. Una señal o un envío vuelven a pedir
// solo las páginas ya cargadas, no el historial entero.
export function useMensajes(chatId: string | undefined) {
  const consulta = useInfiniteQuery({
    queryKey: ["mensajes", chatId],
    queryFn: ({ pageParam }) => chatService.listarMensajes(chatId as string, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (pagina) => pagina.anteriores ?? undefined,
    enabled: chatId !== undefined,
  });
  const { data, hasNextPage, fetchNextPage, isFetchingNextPage } = consulta;
  // Las páginas llegan de la más reciente a la más vieja: se dan vuelta para mostrar el más reciente al final.
  const mensajes = useMemo(() => [...(data?.pages ?? [])].reverse().flatMap((p) => p.mensajes), [data]);
  return {
    mensajes,
    // Ya llegó la primera página (para no mostrar "no hay mensajes" mientras carga).
    listo: data !== undefined,
    hayAnteriores: hasNextPage,
    cargarAnteriores: () => void fetchNextPage(),
    cargandoAnteriores: isFetchingNextPage,
  };
}
