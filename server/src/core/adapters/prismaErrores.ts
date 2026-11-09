import { Prisma } from "@prisma/client";
import { ConflictError, EntityNotFoundError } from "../errors";

// Traduce el error de una escritura de Prisma a un error de dominio: fila inexistente (P2025) → 404; choque con una
// restricción de unicidad (P2002) → 409. Cualquier otro error sigue su camino.
export function traducirErrorDeEscritura(error: unknown, entidad: string, id: string): unknown {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2025") return new EntityNotFoundError(entidad, id);
    if (error.code === "P2002") {
      const campos = ((error.meta?.target as string[] | undefined) ?? []).map((c) => (c === "dni" ? "DNI" : c));
      return new ConflictError(`Ya existe un registro con ese ${campos.join(", ") || "dato"}`);
    }
  }
  return error;
}
