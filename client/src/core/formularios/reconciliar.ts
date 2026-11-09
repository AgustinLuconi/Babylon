// Lógica pura del aviso "Mientras editabas…" (sin dependencias del proyecto: se prueba desde server/tests/).

const normalizar = (valor: unknown) => (typeof valor === "string" ? valor.trim() : valor);
const igual = (a: unknown, b: unknown) => JSON.stringify(normalizar(a)) === JSON.stringify(normalizar(b));

// Un campo está "sin tocar" si lo que hay en el formulario es igual a lo último que el servidor dijo (`base`). Cuando el
// servidor trae un valor nuevo, los campos sin tocar lo toman y se listan en `actualizados`; los tocados conservan lo
// que escribió quien edita (sin marcar conflicto: se guarda lo suyo). La base nueva es siempre lo que dice el servidor.
export function reconciliar<T extends Record<string, unknown>>(entrada: {
  valores: T;
  base: T;
  servidor: T;
}): { valores: T; base: T; actualizados: (keyof T)[] } {
  const { valores, base, servidor } = entrada;
  const resultado = { ...valores };
  const actualizados: (keyof T)[] = [];
  for (const clave of Object.keys(servidor) as (keyof T)[]) {
    const sinTocar = igual(valores[clave], base[clave]);
    if (sinTocar && !igual(servidor[clave], base[clave])) {
      resultado[clave] = servidor[clave];
      actualizados.push(clave);
    }
  }
  return { valores: resultado, base: servidor, actualizados };
}

// "teléfono", "teléfono y dirección", "a, b y c".
const enLista = (etiquetas: string[]) => (etiquetas.length <= 1 ? etiquetas.join("") : `${etiquetas.slice(0, -1).join(", ")} y ${etiquetas[etiquetas.length - 1]}`);

// `quien`: el nombre de quien hizo el cambio, `null` si lo hizo el sistema (tarea automática) y `undefined` si no se sabe.
export function textoDelAviso(quien: string | null | undefined, etiquetas: string[]): string {
  const autor = quien === null ? "el sistema" : (quien ?? "alguien");
  return `Mientras editabas, ${autor} cambió: ${enLista(etiquetas)}. Ya se actualizó en el formulario.`;
}
