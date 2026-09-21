-- DropForeignKey
ALTER TABLE "Alumno" DROP CONSTRAINT "Alumno_padreId_fkey";

-- AlterTable
ALTER TABLE "Alumno" ALTER COLUMN "padreId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "Alumno" ADD CONSTRAINT "Alumno_padreId_fkey" FOREIGN KEY ("padreId") REFERENCES "Padre"("id") ON DELETE SET NULL ON UPDATE CASCADE;
