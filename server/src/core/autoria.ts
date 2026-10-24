import { AsyncLocalStorage } from "node:async_hooks";
import type { Rol } from "./ports";

// Quién hizo el pedido en curso. `authMiddleware` lo deja para todo lo que corre a partir de ahí (incluidas las tareas
// que se ejecutan al confirmar la transacción), así ningún service tiene que recibirlo por parámetro para anunciar
// "quién cambió qué". Las tareas automáticas (la de las 03:00, por ejemplo) no tienen autor.
export interface Autor {
  usuarioId: string;
  rol: Rol;
}

const almacen = new AsyncLocalStorage<Autor>();

export function ejecutarComo<T>(autor: Autor, fn: () => T): T {
  return almacen.run(autor, fn);
}

export function autorActual(): Autor | null {
  return almacen.getStore() ?? null;
}
