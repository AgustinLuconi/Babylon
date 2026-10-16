import { useCallback } from "react";
import { useSearchParams } from "react-router-dom";

// Filtros, pestañas y selecciones que viven en la dirección de la página (?curso=…&fecha=…): un enlace (el de un
// aviso, por ejemplo) los trae puestos, recargar los conserva y la dirección se puede compartir. Cambiar uno reemplaza
// la entrada del historial: "atrás" lleva a la pantalla anterior, no al filtro anterior.
// Nunca guardar acá lo que se está escribiendo sin guardar ni el texto de un buscador: nombres y DNI de alumnos (menores)
// terminarían en el historial del navegador y en los registros del servidor.
export function useFiltrosDeUrl() {
  const [params, setParams] = useSearchParams();
  const leer = useCallback((nombre: string) => params.get(nombre), [params]);
  const escribir = useCallback(
    (cambios: Record<string, string | null | undefined>) =>
      setParams(
        (actuales) => {
          const nuevos = new URLSearchParams(actuales);
          for (const [nombre, valor] of Object.entries(cambios)) {
            if (valor === null || valor === undefined || valor === "") nuevos.delete(nombre);
            else nuevos.set(nombre, valor);
          }
          return nuevos;
        },
        { replace: true },
      ),
    [setParams],
  );
  return { leer, escribir };
}

// Un valor de la dirección solo si es uno de los permitidos; si no (viejo, mal escrito o ajeno), el de por defecto.
export function elegir<T extends string>(valor: string | null, permitidos: readonly T[], porDefecto: T): T {
  return valor !== null && (permitidos as readonly string[]).includes(valor) ? (valor as T) : porDefecto;
}
