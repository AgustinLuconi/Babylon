// Lo que hay que mandar al guardar una edición: solo los campos que cambiaron respecto de lo último que el servidor
// dijo (`base`). Un texto se compara recortado; un texto vacío es "sin dato". Vaciar un campo borrable manda `null`;
// vaciar uno obligatorio no manda nada (la validación de la pantalla ya lo avisa). Sin dependencias del proyecto: se
// prueba desde server/tests/.
const vacio = (valor: unknown) => valor === undefined || valor === null || (typeof valor === "string" && valor.trim() === "");

export function cambiosParaEnviar<T extends Record<string, unknown>>(
  valores: T,
  base: T,
  borrables: readonly (keyof T)[],
): Partial<Record<keyof T, unknown>> {
  const cambios: Partial<Record<keyof T, unknown>> = {};
  for (const clave of Object.keys(valores) as (keyof T)[]) {
    const nuevo = valores[clave];
    const anterior = base[clave];
    if (vacio(nuevo) && vacio(anterior)) continue;
    if (typeof nuevo === "string" && typeof anterior === "string" && nuevo.trim() === anterior.trim()) continue;
    if (typeof nuevo !== "string" && JSON.stringify(nuevo) === JSON.stringify(anterior)) continue;
    if (typeof nuevo === "string") {
      const texto = nuevo.trim();
      if (texto !== "") cambios[clave] = texto;
      else if (borrables.includes(clave)) cambios[clave] = null;
    } else if (nuevo !== undefined) {
      cambios[clave] = nuevo;
    }
  }
  return cambios;
}

export const hayCambios = (cambios: object): boolean => Object.keys(cambios).length > 0;
