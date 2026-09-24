-- AlterEnum
ALTER TYPE "EstadoCuota" ADD VALUE 'pendiente';

-- CreateTable
CREATE TABLE "Configuracion" (
    "id" TEXT NOT NULL,
    "valorCuota" DOUBLE PRECISION,

    CONSTRAINT "Configuracion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Cuota_alumnoId_mes_anio_key" ON "Cuota"("alumnoId", "mes", "anio");
