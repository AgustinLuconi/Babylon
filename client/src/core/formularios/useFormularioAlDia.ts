import { useEffect, useRef, useState } from "react";
import { ultimoCambioAjeno } from "@/core/tiempoReal/cambiosEnVivo";
import { reconciliar, textoDelAviso } from "./reconciliar";

const RESALTADO_MS = 2500;
// Un cambio ajeno se le atribuye a quien lo hizo solo si llegó hace poco: pasado ese tiempo, "alguien".
const VENTANA_DE_AUTORIA_MS = 15_000;

interface Opciones<T extends Record<string, unknown>> {
  // El formulario está abierto: solo entonces se reconcilia. Al abrirse toma como base lo que dice `servidor`.
  activo: boolean;
  // Qué dato es (como lo nombra la señal en vivo: "alumnos", "padres", "cursos"…) y de qué registro.
  dato: string;
  claveDeId: string;
  id: string;
  // El registro tal como lo guarda el servidor, con la forma del formulario (mismas claves y textos).
  servidor: T | undefined;
  etiquetas: Record<keyof T, string>;
  // Lo que hay ahora en el formulario y cómo se cambian campos sueltos.
  valores: T;
  aplicar: (parcial: Partial<T>) => void;
}

// Mientras se edita un registro y otra persona lo cambia: los campos sin tocar se actualizan solos, lo escrito se
// conserva y un aviso fijo dice quién y qué. `base` es lo último que el servidor dijo (con eso se calculan los cambios
// al guardar); `resaltados` son los campos recién actualizados (para iluminarlos un momento).
export function useFormularioAlDia<T extends Record<string, unknown>>(opciones: Opciones<T>) {
  const { activo, dato, claveDeId, id, servidor } = opciones;
  const [base, setBase] = useState<T | undefined>(undefined);
  const [aviso, setAviso] = useState<string | null>(null);
  const [resaltados, setResaltados] = useState<ReadonlySet<keyof T>>(new Set());
  const ultimas = useRef(opciones);
  ultimas.current = opciones;
  const baseRef = useRef<T | undefined>(undefined);

  // Al abrir el formulario: la base es lo que dice el servidor en ese momento.
  useEffect(() => {
    if (!activo) {
      baseRef.current = undefined;
      setBase(undefined);
      setAviso(null);
      return;
    }
    baseRef.current = ultimas.current.servidor;
    setBase(ultimas.current.servidor);
  }, [activo, id]);

  // Cuando el servidor trae algo distinto mientras el formulario está abierto.
  useEffect(() => {
    if (!activo || !servidor || !baseRef.current) return;
    if (JSON.stringify(servidor) === JSON.stringify(baseRef.current)) return;
    const { valores, etiquetas, aplicar } = ultimas.current;
    const resultado = reconciliar({ valores, base: baseRef.current, servidor });
    baseRef.current = resultado.base;
    setBase(resultado.base);
    if (resultado.actualizados.length === 0) return;
    aplicar(Object.fromEntries(resultado.actualizados.map((k) => [k, resultado.valores[k]])) as Partial<T>);
    const cambio = ultimoCambioAjeno(dato);
    const reciente = cambio !== undefined && Date.now() - cambio.en <= VENTANA_DE_AUTORIA_MS;
    // Un dato sin ids (la configuración) concierne a cualquiera; el resto, solo si el cambio nombra este registro.
    const concierne = reciente && (claveDeId === "" || cambio.ids[claveDeId]?.includes(id));
    setAviso(textoDelAviso(concierne ? (cambio.por?.nombre ?? null) : undefined, resultado.actualizados.map((k) => etiquetas[k])));
    setResaltados(new Set(resultado.actualizados));
    const t = window.setTimeout(() => setResaltados(new Set()), RESALTADO_MS);
    return () => window.clearTimeout(t);
    // Solo reacciona a un registro nuevo del servidor: el resto se lee de `ultimas`.
  }, [servidor]); // eslint-disable-line react-hooks/exhaustive-deps

  return { base, aviso, resaltados, descartarAviso: () => setAviso(null) };
}
