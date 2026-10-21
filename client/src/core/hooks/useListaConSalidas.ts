import { useEffect, useRef, useState } from "react";
import { huboCambioAjenoReciente } from "@/core/tiempoReal/cambiosEnVivo";

export type EstadoFila = "normal" | "entrando" | "saliendo";

const ENTRADA_MS = 2500;
const SALIDA_MS = 1500;

interface Saliente<T> {
  item: T;
  clave: string;
  indice: number;
  vence: number;
}

// Una lista que, cuando cambia por algo que hizo otra persona, marca las filas nuevas ("entrando", 2,5 s) y deja
// las que salieron un momento en su lugar ("saliendo", 1,5 s) en vez de hacerlas desaparecer de golpe. La primera
// carga y los cambios propios no marcan nada. Cada marca guarda hasta cuándo dura, y un solo temporizador se
// reprograma para la próxima que vence: un cambio nuevo nunca deja una fila "saliendo" para siempre.
export function useListaConSalidas<T>(items: readonly T[], clave: (t: T) => string, datos: readonly string[]): { item: T; estado: EstadoFila }[] {
  const firma = items.map(clave).join("|");
  const previos = useRef<{ claves: string[]; porClave: Map<string, T> } | null>(null);
  const [salientes, setSalientes] = useState<Saliente<T>[]>([]);
  const [entrantes, setEntrantes] = useState<Map<string, number>>(new Map());

  useEffect(() => {
    const claves = items.map(clave);
    const porClave = new Map(items.map((i) => [clave(i), i]));
    const antes = previos.current;
    previos.current = { claves, porClave };
    if (!antes || !huboCambioAjenoReciente(datos)) return;
    const ahora = Date.now();
    const salieron = antes.claves.flatMap((k, indice) =>
      porClave.has(k) ? [] : [{ item: antes.porClave.get(k) as T, clave: k, indice, vence: ahora + SALIDA_MS }],
    );
    const entraron = claves.filter((k) => !antes.porClave.has(k));
    if (salieron.length > 0) setSalientes((s) => [...s.filter((x) => !porClave.has(x.clave)), ...salieron]);
    if (entraron.length > 0) setEntrantes((e) => new Map([...e, ...entraron.map((k) => [k, ahora + ENTRADA_MS] as const)]));
    // La firma resume la lista: con la misma firma no cambió nada.
  }, [firma]); // eslint-disable-line react-hooks/exhaustive-deps

  // Un solo temporizador, para la próxima marca que vence.
  useEffect(() => {
    const vencimientos = [...salientes.map((s) => s.vence), ...entrantes.values()];
    if (vencimientos.length === 0) return;
    const t = window.setTimeout(
      () => {
        const ahora = Date.now();
        setSalientes((s) => s.filter((x) => x.vence > ahora));
        setEntrantes((e) => new Map([...e].filter(([, vence]) => vence > ahora)));
      },
      Math.max(0, Math.min(...vencimientos) - Date.now()) + 20,
    );
    return () => window.clearTimeout(t);
  }, [salientes, entrantes]);

  const resultado: { item: T; estado: EstadoFila }[] = items.map((item) => ({ item, estado: entrantes.has(clave(item)) ? "entrando" : "normal" }));
  // Las que salieron vuelven a su lugar de antes (o al final, si la lista se achicó).
  for (const s of [...salientes].sort((a, b) => a.indice - b.indice)) {
    if (resultado.some((r) => clave(r.item) === s.clave)) continue;
    resultado.splice(Math.min(s.indice, resultado.length), 0, { item: s.item, estado: "saliendo" });
  }
  return resultado;
}

// La clase de cada fila según su estado.
export const claseDeFila = (estado: EstadoFila): string => (estado === "entrando" ? "fila-entrando" : estado === "saliendo" ? "fila-saliendo" : "");
