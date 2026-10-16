// Tareas que tienen que correr recién cuando una transacción se confirma (por ejemplo, mandar una señal en tiempo
// real). PrismaUnitOfWork abre un registro por transacción y, al confirmarse, corre lo pendiente; si se deshace, lo
// descarta. Sin transacción (`tx` undefined o una que no se registró), la tarea corre en el momento.
export type Tarea = () => void | Promise<void>;

const pendientes = new WeakMap<object, Tarea[]>();

export function abrirRegistro(tx: object): Tarea[] {
  const lista: Tarea[] = [];
  pendientes.set(tx, lista);
  return lista;
}

export function alConfirmar(tx: unknown, tarea: Tarea): void {
  const lista = typeof tx === "object" && tx !== null ? pendientes.get(tx) : undefined;
  if (lista) lista.push(tarea);
  else correrSinFallar(tarea);
}

// Nunca afecta a quien la programó: un error solo queda en el log.
export function correrSinFallar(tarea: Tarea): void {
  Promise.resolve()
    .then(tarea)
    .catch((error) => console.error("[alConfirmar] falló una tarea:", error));
}
