-- DropForeignKey
ALTER TABLE "AlertaAutomatica" DROP CONSTRAINT "AlertaAutomatica_alumnoId_fkey";

-- AlterTable
ALTER TABLE "AlertaAutomatica" ADD COLUMN     "evaluacionId" TEXT,
ALTER COLUMN "alumnoId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "AlertaAutomatica_evaluacionId_idx" ON "AlertaAutomatica"("evaluacionId");

-- AddForeignKey
ALTER TABLE "AlertaAutomatica" ADD CONSTRAINT "AlertaAutomatica_alumnoId_fkey" FOREIGN KEY ("alumnoId") REFERENCES "Alumno"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertaAutomatica" ADD CONSTRAINT "AlertaAutomatica_evaluacionId_fkey" FOREIGN KEY ("evaluacionId") REFERENCES "Evaluacion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- El sujeto de una alerta es un alumno o una evaluación, exactamente uno de los dos.
ALTER TABLE "AlertaAutomatica" ADD CONSTRAINT "AlertaAutomatica_un_sujeto_check" CHECK (("alumnoId" IS NOT NULL) <> ("evaluacionId" IS NOT NULL));

-- Hecho a mano (Prisma no sabe expresar índices con COALESCE): una sola alerta abierta por regla y sujeto.
DROP INDEX "AlertaAutomatica_abierta_key";
CREATE UNIQUE INDEX "AlertaAutomatica_abierta_key" ON "AlertaAutomatica" ("regla", COALESCE("alumnoId", ''), COALESCE("cursoId", ''), COALESCE("evaluacionId", '')) WHERE "resueltaEn" IS NULL;
