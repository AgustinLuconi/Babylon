-- Cuenta creada por una invitación y todavía no activada, y fecha de verificación del email.
ALTER TYPE "EstadoUsuario" ADD VALUE 'pendiente';
ALTER TABLE "Usuario" ADD COLUMN "emailVerificadoEn" TIMESTAMP(3);

-- Una sola tabla para los enlaces que se mandan por correo, con su tipo. Los enlaces de recuperación que ya existían
-- se conservan, con tipo "recuperacion".
CREATE TYPE "TipoTokenCuenta" AS ENUM ('recuperacion', 'invitacion', 'verificacion_email');
ALTER TABLE "TokenRecuperacion" RENAME TO "TokenCuenta";
ALTER TABLE "TokenCuenta" ADD COLUMN "tipo" "TipoTokenCuenta" NOT NULL DEFAULT 'recuperacion';
ALTER TABLE "TokenCuenta" ALTER COLUMN "tipo" DROP DEFAULT;
ALTER TABLE "TokenCuenta" RENAME CONSTRAINT "TokenRecuperacion_pkey" TO "TokenCuenta_pkey";
ALTER TABLE "TokenCuenta" RENAME CONSTRAINT "TokenRecuperacion_usuarioId_fkey" TO "TokenCuenta_usuarioId_fkey";
ALTER INDEX "TokenRecuperacion_hash_key" RENAME TO "TokenCuenta_hash_key";
DROP INDEX "TokenRecuperacion_usuarioId_creadoEn_idx";
CREATE INDEX "TokenCuenta_usuarioId_tipo_creadoEn_idx" ON "TokenCuenta"("usuarioId", "tipo", "creadoEn");
