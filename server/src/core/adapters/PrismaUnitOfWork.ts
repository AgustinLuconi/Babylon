import type { Prisma, PrismaClient } from "@prisma/client";
import { abrirRegistro, correrSinFallar, type Tarea } from "../alConfirmar";
import type { UnitOfWork } from "../ports";

export type PrismaTransactionClient = Prisma.TransactionClient;

const TIEMPO_MAXIMO_MS = 20_000;

export class PrismaUnitOfWork implements UnitOfWork<PrismaTransactionClient> {
  constructor(private readonly prisma: PrismaClient) {}

  // Lo que se programó con alConfirmar(tx, …) corre solo si la transacción se confirma.
  async runInTransaction<T>(work: (tx: PrismaTransactionClient) => Promise<T>): Promise<T> {
    let alConfirmarse: Tarea[] = [];
    const resultado = await this.prisma.$transaction(
      (tx: PrismaTransactionClient) => {
        alConfirmarse = abrirRegistro(tx);
        return work(tx);
      },
      // Las operaciones que recalculan avisos (activar un ciclo, reactivar una cuenta) pueden pasar los 5 s que Prisma
      // da por defecto con una base remota: se les da más margen.
      { maxWait: 5_000, timeout: TIEMPO_MAXIMO_MS },
    );
    for (const tarea of alConfirmarse) correrSinFallar(tarea);
    return resultado;
  }
}
