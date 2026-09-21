export type Rol = "admin" | "secretario" | "profesor" | "padre";

// `tx` es opaco a propósito (unknown, no un tipo de Prisma): el puerto no
// puede saber qué motor de persistencia lo implementa. Cuando un service
// corre dentro de `UnitOfWork.runInTransaction`, reenvía el `context` que
// recibe como `tx` a cada llamada al repositorio — así, si el repositorio es
// Prisma, todas las operaciones quedan dentro de la misma transacción real
// (con FakeUnitOfWork, `tx` es `undefined` y los Fake lo ignoran).
export interface Repository<T, ID = string> {
  findById(id: ID, tx?: unknown): Promise<T | null>;
  findAll(tx?: unknown): Promise<T[]>;
  create(entidad: T, tx?: unknown): Promise<T>;
  update(id: ID, entidad: T, tx?: unknown): Promise<T>;
  delete(id: ID, tx?: unknown): Promise<void>;
}

export interface UnitOfWork<TContext = unknown> {
  runInTransaction<T>(work: (context: TContext) => Promise<T>): Promise<T>;
}
