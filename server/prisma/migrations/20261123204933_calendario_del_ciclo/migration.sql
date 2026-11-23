-- CreateEnum
CREATE TYPE "TipoPausa" AS ENUM ('receso', 'feriado', 'otro');

-- AlterTable
ALTER TABLE "Ciclo" ADD COLUMN     "fin" TIMESTAMP(3),
ADD COLUMN     "inicio" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Configuracion" ADD COLUMN     "diaVencimiento" INTEGER NOT NULL DEFAULT 10;

-- CreateTable
CREATE TABLE "PausaDelCiclo" (
    "id" TEXT NOT NULL,
    "cicloId" TEXT NOT NULL,
    "desde" TIMESTAMP(3) NOT NULL,
    "hasta" TIMESTAMP(3) NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" "TipoPausa" NOT NULL,

    CONSTRAINT "PausaDelCiclo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PausaDelCiclo_cicloId_idx" ON "PausaDelCiclo"("cicloId");

-- AddForeignKey
ALTER TABLE "PausaDelCiclo" ADD CONSTRAINT "PausaDelCiclo_cicloId_fkey" FOREIGN KEY ("cicloId") REFERENCES "Ciclo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Inicio y fin van juntos (los dos null = calendario por defecto) y en orden.
ALTER TABLE "Ciclo" ADD CONSTRAINT "Ciclo_fechas_check" CHECK (("inicio" IS NULL) = ("fin" IS NULL) AND ("inicio" IS NULL OR "inicio" <= "fin"));
-- Una pausa termina el mismo día o después de empezar.
ALTER TABLE "PausaDelCiclo" ADD CONSTRAINT "PausaDelCiclo_orden_check" CHECK ("desde" <= "hasta");
