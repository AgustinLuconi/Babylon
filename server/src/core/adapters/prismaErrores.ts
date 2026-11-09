import { Prisma } from "@prisma/client";
import { ConflictError, EntityNotFoundError, ValidationError } from "../errors";

// Traduce el error de una escritura de Prisma a un error de dominio: fila inexistente (P2025) → 404; choque con una
// restricción de unicidad (P2002) → 409; referencia a algo que no existe (P2003) → 400. Cualquier otro error sigue su camino.
// `etiqueta` es cómo se nombra el registro en el mensaje del 409 ("Ya existe un alumno con ese DNI").
export function traducirErrorDeEscritura(error: unknown, entidad: string, id: string, etiqueta = "registro"): unknown {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2025") return new EntityNotFoundError(entidad, id);
    if (error.code === "P2003") return new ValidationError("Uno de los datos hace referencia a algo que no existe");
    if (error.code === "P2002") {
      const campos = ((error.meta?.target as string[] | undefined) ?? []).map((c) => (c === "dni" ? "DNI" : c));
      return new ConflictError(`Ya existe un ${etiqueta} con ese ${campos.join(", ") || "dato"}`);
    }
  }
  return error;
}
