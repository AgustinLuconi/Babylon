/*
  Warnings:

  - Made the column `cicloId` on table `Curso` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "Curso" DROP CONSTRAINT "Curso_cicloId_fkey";

-- AlterTable
ALTER TABLE "Curso" ALTER COLUMN "cicloId" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "Curso" ADD CONSTRAINT "Curso_cicloId_fkey" FOREIGN KEY ("cicloId") REFERENCES "Ciclo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
