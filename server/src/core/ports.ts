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

// Lo que authMiddleware necesita saber de una cuenta para aceptar su token.
// core/ no puede importar modules/, así que container.ts le inyecta la
// implementación con configurarValidadorDeSesion().
export interface EstadoDeSesion {
  activo: boolean;
  contrasenaCambiadaEn: Date | null;
}

export type ValidadorDeSesion = (usuarioId: string) => Promise<EstadoDeSesion | null>;
