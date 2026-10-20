import { useEffect, useRef, useState } from "react";
import { huboCambioAjenoReciente } from "@/core/tiempoReal/cambiosEnVivo";

export type EstadoFila = "normal" | "entrando" | "saliendo";

const ENTRADA_MS = 2500;
const SALIDA_MS = 1500;

// Una lista que, cuando cambia por algo que hizo otra persona, marca las filas nuevas ("entrando", 2,5 s) y deja
// las que salieron un momento en su lugar ("saliendo", 1,5 s) en vez de hacerlas desaparecer de golpe. La primera
// carga y los cambios propios no marcan nada.
export function useListaConSalidas<T>(items: readonly T[], clave: (t: T) => string, datos: readonly string[]): { item: T; estado: EstadoFila }[] {
  const firma = items.map(clave).join("|");
  const previos = useRef<{ claves: string[]; porClave: Map<string, T> } | null>(null);
  const [salientes, setSalientes] = useState<{ item: T; clave: string; indice: number }[]>([]);
  const [entrantes, setEntrantes] = useState<Set<string>>(new Set());

  useEffect(() => {
    const claves = items.map(clave);
    const porClave = new Map(items.map((i) => [clave(i), i]));
    const antes = previos.current;
    previos.current = { claves, porClave };
    if (!antes || !huboCambioAjenoReciente(datos)) return;
    const salieron = antes.claves.flatMap((k, indice) => (porClave.has(k) ? [] : [{ item: antes.porClave.get(k) as T, clave: k, indice }]));
    const entraron = claves.filter((k) => !antes.porClave.has(k));
    const temporizadores: number[] = [];
    if (salieron.length > 0) {
      setSalientes((s) => [...s, ...salieron]);
      const fuera = new Set(salieron.map((x) => x.clave));
      temporizadores.push(window.setTimeout(() => setSalientes((s) => s.filter((x) => !fuera.has(x.clave))), SALIDA_MS));
    }
    if (entraron.length > 0) {
      setEntrantes((e) => new Set([...e, ...entraron]));
      temporizadores.push(
        window.setTimeout(
          () =>
            setEntrantes((e) => {
              const quedan = new Set(e);
              for (const k of entraron) quedan.delete(k);
              return quedan;
            }),
          ENTRADA_MS,
        ),
      );
    }
    return () => temporizadores.forEach((t) => window.clearTimeout(t));
    // La firma resume la lista: con la misma firma no cambió nada.
  }, [firma]); // eslint-disable-line react-hooks/exhaustive-deps

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
