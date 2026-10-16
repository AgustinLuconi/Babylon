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

// Lo que authMiddleware necesita para aceptar un token: que la sesión (`sid`) exista, sea de esa cuenta, esté
// abierta y sin vencer, y que la cuenta siga activa. core/ no puede importar modules/, así que container.ts le
// inyecta la implementación con configurarValidadorDeSesion().
export type ValidadorDeSesion = (sesionId: string, usuarioId: string) => Promise<boolean>;

export interface MensajeCorreo {
  para: string;
  asunto: string;
  texto: string;
  html: string;
}

// Envío de correos. container.ts elige el adaptador: SMTP real si está
// configurado, consola en desarrollo.
export interface Mailer {
  enviar(mensaje: MensajeCorreo): Promise<void>;
}

// Anuncios entre módulos (ver core/eventos.ts). `M` es el mapa nombre → datos de los anuncios que publica un módulo.
// `tx` es la transacción en curso: lo que se suscribe "dentro" corre en ella; sin `tx`, todo corre en el momento.
export interface Publicador<M> {
  publicar<K extends keyof M & string>(nombre: K, datos: M[K], tx?: unknown): Promise<void>;
}
