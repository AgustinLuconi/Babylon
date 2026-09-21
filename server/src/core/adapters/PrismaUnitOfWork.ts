import type { Prisma, PrismaClient } from "@prisma/client";
import type { UnitOfWork } from "../ports";

export type PrismaTransactionClient = Prisma.TransactionClient;

export class PrismaUnitOfWork implements UnitOfWork<PrismaTransactionClient> {
  constructor(private readonly prisma: PrismaClient) {}

  runInTransaction<T>(work: (tx: PrismaTransactionClient) => Promise<T>): Promise<T> {
    return this.prisma.$transaction((tx: PrismaTransactionClient) => work(tx));
  }
}
