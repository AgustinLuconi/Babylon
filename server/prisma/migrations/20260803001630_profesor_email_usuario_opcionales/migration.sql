-- DropForeignKey
ALTER TABLE "Profesor" DROP CONSTRAINT "Profesor_usuarioId_fkey";

-- AlterTable
ALTER TABLE "Profesor" ALTER COLUMN "email" DROP NOT NULL,
ALTER COLUMN "usuarioId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "Profesor" ADD CONSTRAINT "Profesor_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
