import { zodResolver } from "@hookform/resolvers/zod";
import type { FieldValues, Resolver } from "react-hook-form";
import type { z } from "zod";

// Resolver de react-hook-form para EDITAR: valida con el esquema, pero descarta los errores de los campos que siguen
// iguales a lo último que dijo el servidor (`base`). Así un dato viejo que hoy no cumpliría las reglas (un celular con una
// letra al final) no impide guardar un cambio en otro campo. Sin base (al crear), valida todo.
export function resolverSoloModificados<TEntrada extends FieldValues, TSalida = TEntrada>(
  esquema: z.ZodType,
  base: () => Record<string, unknown> | undefined,
): Resolver<TEntrada, unknown, TSalida> {
  const completo = zodResolver(esquema as never) as unknown as Resolver<TEntrada, unknown, TSalida>;
  return async (valores, contexto, opciones) => {
    const resultado = await completo(valores, contexto, opciones);
    const anterior = base();
    if (!anterior || !resultado.errors || Object.keys(resultado.errors).length === 0) return resultado;
    const iguales = (campo: string) => JSON.stringify(valores[campo]) === JSON.stringify(anterior[campo]);
    const errores = Object.fromEntries(Object.entries(resultado.errors).filter(([campo]) => !iguales(campo)));
    return Object.keys(errores).length > 0 ? { values: {}, errors: errores as never } : { values: valores as unknown as TSalida, errors: {} };
  };
}
