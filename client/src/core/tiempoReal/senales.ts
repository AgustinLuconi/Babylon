import type { SenalEnVivo } from "./lectorSse";

// Reparte las señales de la conexión en vivo a quien las quiera escuchar (por ejemplo, features/cambios), sin que
// core/ tenga que conocer a los features.
type Oyente = (senal: SenalEnVivo) => void;
const oyentes = new Map<string, Set<Oyente>>();

export function emitirSenal(senal: SenalEnVivo): void {
  for (const oyente of oyentes.get(senal.tipo) ?? []) {
    try {
      oyente(senal);
    } catch (error) {
      console.error("[senales] falló un oyente:", error);
    }
  }
}

export function escucharSenal(tipo: string, oyente: Oyente): () => void {
  const lista = oyentes.get(tipo) ?? new Set<Oyente>();
  lista.add(oyente);
  oyentes.set(tipo, lista);
  return () => lista.delete(oyente);
}
