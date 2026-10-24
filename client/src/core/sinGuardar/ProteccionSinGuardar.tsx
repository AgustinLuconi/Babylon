import { useEffect } from "react";
import { useBlocker } from "react-router-dom";
import { ConfirmarSalida } from "./ConfirmarSalida";
import { hayVersionNueva } from "@/core/version/version";
import { confirmarSalida, descartarCambiosSinGuardar, hayCambiosSinGuardar } from "./sinGuardar";

// Antes de cualquier cambio de dirección (otra pantalla o un filtro de la misma, que también descarta lo escrito)
// con algo sin guardar, pregunta. Recargar o cerrar la pestaña muestra el aviso propio del navegador. Con una versión
// nueva publicada, ir a otra pantalla recarga la página en esa pantalla (después de preguntar, si hay algo sin guardar).
export function ProteccionSinGuardar() {
  const bloqueo = useBlocker(
    ({ currentLocation, nextLocation }) =>
      (hayCambiosSinGuardar() || hayVersionNueva()) &&
      (currentLocation.pathname !== nextLocation.pathname || currentLocation.search !== nextLocation.search),
  );

  useEffect(() => {
    if (bloqueo.state !== "blocked") return;
    const destino = bloqueo.location;
    const preguntar = hayCambiosSinGuardar() ? confirmarSalida() : Promise.resolve(true);
    void preguntar.then((salir) => {
      if (!salir) return bloqueo.reset();
      if (!hayVersionNueva()) return bloqueo.proceed();
      // Versión nueva: en vez de cambiar de pantalla, se recarga la página ya en la pantalla pedida.
      bloqueo.reset();
      // Ya se eligió salir: el aviso propio del navegador no tiene que volver a preguntar.
      descartarCambiosSinGuardar();
      window.location.assign(`${destino.pathname}${destino.search}${destino.hash}`);
    });
  }, [bloqueo]);

  useEffect(() => {
    const alSalir = (e: BeforeUnloadEvent) => {
      if (!hayCambiosSinGuardar()) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", alSalir);
    return () => window.removeEventListener("beforeunload", alSalir);
  }, []);

  return <ConfirmarSalida />;
}
