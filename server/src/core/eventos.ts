import { alConfirmar } from "./alConfirmar";
import type { Publicador } from "./ports";

type Dentro<D> = (datos: D, tx: unknown) => Promise<void>;
type Despues<D> = (datos: D) => void | Promise<void>;

// Tablero de anuncios: los módulos publican lo que pasó y otros se suscriben, sin conocerse entre sí (container.ts
// conecta las suscripciones). Hay dos momentos:
// - dentro de la transacción (`alPublicarse`): corre en el acto, con el mismo `tx`; si falla, la operación entera se
//   deshace. Para lo que tiene que guardarse junto con la operación (los avisos).
// - después de confirmar (`alConfirmarse`): corre solo si la transacción se confirma; si falla, queda en el log.
export class TableroDeAnuncios<M> implements Publicador<M> {
  private readonly dentro = new Map<string, Dentro<never>[]>();
  private readonly despues = new Map<string, Despues<never>[]>();

  alPublicarse<K extends keyof M & string>(nombre: K, suscriptor: Dentro<M[K]>): void {
    this.dentro.set(nombre, [...(this.dentro.get(nombre) ?? []), suscriptor as Dentro<never>]);
  }

  alConfirmarse<K extends keyof M & string>(nombre: K, suscriptor: Despues<M[K]>): void {
    this.despues.set(nombre, [...(this.despues.get(nombre) ?? []), suscriptor as Despues<never>]);
  }

  async publicar<K extends keyof M & string>(nombre: K, datos: M[K], tx?: unknown): Promise<void> {
    for (const suscriptor of this.dentro.get(nombre) ?? []) await (suscriptor as Dentro<M[K]>)(datos, tx);
    for (const suscriptor of this.despues.get(nombre) ?? []) alConfirmar(tx, () => (suscriptor as Despues<M[K]>)(datos));
  }
}

// Para los services construidos sin tablero (scripts de prueba viejos): publicar no hace nada.
export function sinAnuncios<M>(): Publicador<M> {
  return { publicar: async () => {} };
}
