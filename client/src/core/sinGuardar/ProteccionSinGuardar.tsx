import { useEffect } from "react";
import { useBlocker } from "react-router-dom";
import { ConfirmarSalida } from "./ConfirmarSalida";
import { confirmarSalida, hayCambiosSinGuardar } from "./sinGuardar";

// Antes de cualquier cambio de dirección (otra pantalla o un filtro de la misma, que también descarta lo escrito)
// con algo sin guardar, pregunta. Recargar o cerrar la pestaña muestra el aviso propio del navegador.
export function ProteccionSinGuardar() {
  const bloqueo = useBlocker(
    ({ currentLocation, nextLocation }) =>
      hayCambiosSinGuardar() && (currentLocation.pathname !== nextLocation.pathname || currentLocation.search !== nextLocation.search),
  );

  useEffect(() => {
    if (bloqueo.state !== "blocked") return;
    void confirmarSalida().then((salir) => (salir ? bloqueo.proceed() : bloqueo.reset()));
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
