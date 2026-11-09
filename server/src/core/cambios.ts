// Deja solo las claves presentes de un pedido de edición: una clave ausente (undefined) no se toca, y `null` se conserva
// porque borra el dato. Es lo que se le pasa a `actualizarParcial`.
export function soloPresentes<T extends object>(datos: T): { [K in keyof T]?: Exclude<T[K], undefined> } {
  return Object.fromEntries(Object.entries(datos).filter(([, valor]) => valor !== undefined)) as { [K in keyof T]?: Exclude<T[K], undefined> };
}
