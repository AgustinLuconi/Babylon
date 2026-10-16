import type { Prisma, PrismaClient } from "@prisma/client";
import { abrirRegistro, correrSinFallar, type Tarea } from "../alConfirmar";
import type { UnitOfWork } from "../ports";

export type PrismaTransactionClient = Prisma.TransactionClient;

export class PrismaUnitOfWork implements UnitOfWork<PrismaTransactionClient> {
  constructor(private readonly prisma: PrismaClient) {}

  // Lo que se programó con alConfirmar(tx, …) corre solo si la transacción se confirma.
  async runInTransaction<T>(work: (tx: PrismaTransactionClient) => Promise<T>): Promise<T> {
    let alConfirmarse: Tarea[] = [];
    const resultado = await this.prisma.$transaction((tx: PrismaTransactionClient) => {
      alConfirmarse = abrirRegistro(tx);
      return work(tx);
    });
    for (const tarea of alConfirmarse) correrSinFallar(tarea);
    return resultado;
  }
}
