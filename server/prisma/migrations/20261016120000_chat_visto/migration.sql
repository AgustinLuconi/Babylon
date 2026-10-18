-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "TipoNotificacion" ADD VALUE 'mensajes_familia';
ALTER TYPE "TipoNotificacion" ADD VALUE 'mensajes_instituto';

-- AlterTable
ALTER TABLE "Mensaje" ADD COLUMN     "vistoEn" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Mensaje_chatId_rolEmisor_vistoEn_idx" ON "Mensaje"("chatId", "rolEmisor", "vistoEn");


-- Los mensajes que ya existían quedan vistos: no generan avisos de mensajes viejos.
UPDATE "Mensaje" SET "vistoEn" = "fecha" WHERE "vistoEn" IS NULL;
