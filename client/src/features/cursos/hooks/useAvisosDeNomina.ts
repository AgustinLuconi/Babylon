import { useEffect, useRef, useState } from "react";
import { ultimoCambioAjeno } from "@/core/tiempoReal/cambiosEnVivo";

export interface AvisoDeNomina {
  id: string;
  texto: string;
}

interface AlumnoDeNomina {
  id: string;
  nombre: string;
  apellido: string;
}

// Cuando la nómina de un curso cambia mientras el profesor la tiene abierta (la secretaría inscribe, da de baja o
// cambia de curso a un alumno), arma avisos fijos que explican qué pasó. Cambiar de curso los reinicia.
export function useAvisosDeNomina(cursoId: string | undefined, alumnos: AlumnoDeNomina[] | undefined) {
  const previo = useRef<{ cursoId: string | undefined; nombres: Map<string, string> } | null>(null);
  const [avisos, setAvisos] = useState<AvisoDeNomina[]>([]);
  const firma = alumnos?.map((a) => a.id).join("|");

  useEffect(() => {
    if (!alumnos) return;
    const nombres = new Map(alumnos.map((a) => [a.id, `${a.nombre} ${a.apellido}`]));
    const antes = previo.current;
    previo.current = { cursoId, nombres };
    if (!antes || antes.cursoId !== cursoId) {
      setAvisos([]);
      return;
    }
    const cambio = ultimoCambioAjeno("alumnos");
    const quien = cambio?.por?.nombre.trim().split(/\s+/)[0];
    const verbo = cambio?.accion === "reactivacion" ? "reactivó a" : cambio?.accion === "cambio-curso" ? "pasó a" : "inscribió a";
    const nuevos: AvisoDeNomina[] = [];
    for (const [id, nombre] of nombres) {
      if (!antes.nombres.has(id)) {
        nuevos.push({ id: `entra-${id}-${Date.now()}`, texto: quien ? `${quien} ${verbo} ${nombre} en este curso` : `${nombre} se sumó a este curso` });
      }
    }
    for (const [id, nombre] of antes.nombres) {
      if (!nombres.has(id)) nuevos.push({ id: `sale-${id}-${Date.now()}`, texto: `${nombre} ya no está en este curso` });
    }
    if (nuevos.length > 0) setAvisos((a) => [...a, ...nuevos]);
    // La firma resume la nómina.
  }, [cursoId, firma]); // eslint-disable-line react-hooks/exhaustive-deps

  const cerrar = (id: string) => setAvisos((a) => a.filter((x) => x.id !== id));
  return { avisos, cerrar };
}
