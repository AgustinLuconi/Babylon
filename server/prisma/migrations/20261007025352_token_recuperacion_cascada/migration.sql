-- DropForeignKey
ALTER TABLE "TokenRecuperacion" DROP CONSTRAINT "TokenRecuperacion_usuarioId_fkey";

-- AddForeignKey
ALTER TABLE "TokenRecuperacion" ADD CONSTRAINT "TokenRecuperacion_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
