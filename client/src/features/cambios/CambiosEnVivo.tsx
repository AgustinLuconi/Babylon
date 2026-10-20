import { useEffect } from "react";
import { useQueryClient, type QueryKey } from "@tanstack/react-query";
import { registrarCambioAjeno } from "@/core/tiempoReal/cambiosEnVivo";
import { escucharSenal } from "@/core/tiempoReal/senales";
import { useSessionStore } from "@/core/store/sessionStore";
import { clavesAfectadas } from "./claves";
import { mostrarMensajeDeCambio } from "./cola";
import type { SenalCambio } from "./types";

const ESPERA_RECARGA_MS = 300;

// Cada señal `cambio` vuelve a pedir solo lo afectado y, si la hizo otra persona, deja el mensaje "quién hizo qué".
// Varias señales seguidas (un lote de cobros) se juntan en una sola recarga: se espera a que pasen 300 ms sin señales.
// Al reconectarse (un `listo` que no es el primero), se vuelve a pedir todo lo que está en pantalla: lo que pasó con la
// conexión cortada no tuvo señal.
export function CambiosEnVivo() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const pendientes = new Map<string, QueryKey>();
    let todo = false;
    let temporizador: number | undefined;
    const recargar = () => {
      if (todo) void queryClient.invalidateQueries();
      else for (const clave of pendientes.values()) void queryClient.invalidateQueries({ queryKey: clave });
      pendientes.clear();
      todo = false;
    };
    const programar = () => {
      window.clearTimeout(temporizador);
      temporizador = window.setTimeout(recargar, ESPERA_RECARGA_MS);
    };

    const dejarDeEscuchar = escucharSenal("cambio", ({ datos }) => {
      const cambio = datos as SenalCambio;
      const claves = clavesAfectadas(cambio);
      if (claves === "todo") todo = true;
      else for (const clave of claves) pendientes.set(JSON.stringify(clave), clave);
      programar();
      const propio = cambio.por !== null && cambio.por.usuarioId === useSessionStore.getState().usuario?.id;
      if (!propio) {
        registrarCambioAjeno(cambio.dato, { por: cambio.por, ids: cambio.ids });
        mostrarMensajeDeCambio(cambio);
      }
    });

    let conexiones = 0;
    const dejarDeEscucharListo = escucharSenal("listo", () => {
      conexiones++;
      if (conexiones > 1) {
        todo = true;
        programar();
      }
    });

    return () => {
      dejarDeEscuchar();
      dejarDeEscucharListo();
      window.clearTimeout(temporizador);
    };
  }, [queryClient]);

  return null;
}
