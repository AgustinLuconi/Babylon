import { useEffect, useRef, useState } from "react";
import { huboCambioAjenoReciente } from "@/core/tiempoReal/cambiosEnVivo";

const DURACION_MS = 2500;
// Sin datos indicados, cualquier cambio ajeno reciente (un número de un panel depende de muchos datos).
const CUALQUIERA = [
  "cuotas",
  "alumnos",
  "cursos",
  "evaluaciones",
  "calificaciones",
  "notas-cierre",
  "asistencia",
  "observaciones",
  "categorias",
  "documentos",
  "padres",
  "profesores",
  "usuarios",
  "configuracion",
  "ciclos",
];

// true durante 2,5 s cuando `valor` cambia por un cambio que hizo otra persona (llegado en vivo). La primera carga y lo
// que la persona hace ella misma no resaltan.
export function useResaltado(valor: unknown, datos: readonly string[] = CUALQUIERA): boolean {
  const clave = JSON.stringify(valor) ?? "∅";
  const previo = useRef<string | null>(null);
  const [activo, setActivo] = useState(false);

  useEffect(() => {
    const antes = previo.current;
    previo.current = clave;
    if (antes === null || antes === clave || !huboCambioAjenoReciente(datos)) return;
    setActivo(true);
    const t = window.setTimeout(() => setActivo(false), DURACION_MS);
    return () => window.clearTimeout(t);
    // `datos` es una lista fija por pantalla.
  }, [clave]); // eslint-disable-line react-hooks/exhaustive-deps

  return activo;
}
