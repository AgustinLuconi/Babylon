import type { Repository } from "../../core/ports";
import type { Sesion } from "./sesion.entity";

export interface SesionRepository extends Repository<Sesion> {
  // Una sola consulta: la sesión solo si es de esa cuenta, no está cerrada ni vencida y la cuenta está activa.
  buscarValida(id: string, usuarioId: string, ahora: Date): Promise<Sesion | null>;
  // Actualiza `ultimoUsoEn` solo si el valor guardado es anterior a `antesDe` (actualización condicional: si dos
  // pedidos coinciden, solo uno escribe). Devuelve si escribió.
  registrarUso(id: string, ahora: Date, antesDe: Date): Promise<boolean>;
  // Marca la sesión como usada ahora, sin condición.
  tocar(id: string, ahora: Date): Promise<void>;
  // Sesiones abiertas y no vencidas de la cuenta, las más recientes primero.
  findActivasByUsuario(usuarioId: string, ahora: Date, tx?: unknown): Promise<Sesion[]>;
  // Cierra una sesión de esa cuenta; false si no existe, es de otra cuenta o ya estaba cerrada/vencida.
  cerrar(id: string, usuarioId: string, ahora: Date, tx?: unknown): Promise<boolean>;
  // Cierra todas las sesiones abiertas de la cuenta, menos `excepto`; devuelve cuántas cerró.
  cerrarTodas(usuarioId: string, ahora: Date, excepto?: string, tx?: unknown): Promise<number>;
  // Borra las sesiones que terminaron (cerradas o vencidas) antes de `limite`; devuelve cuántas. Nunca toca las activas.
  depurarTerminadasAntesDe(limite: Date): Promise<number>;
}
