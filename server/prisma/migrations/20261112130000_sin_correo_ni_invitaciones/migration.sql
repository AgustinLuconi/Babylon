-- Las cuentas las administra solo el administrador: no hay correos, invitaciones, recuperación ni verificación de email.
-- Guarda: una cuenta "pendiente" (invitación sin aceptar) quedaría sin forma de activarse; la migración se detiene en vez de
-- dejarla rota (hay que cancelarla o activarla antes de migrar).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "Usuario" WHERE "estado" = 'pendiente') THEN
    RAISE EXCEPTION 'Quedan cuentas pendientes (invitaciones sin aceptar): hay que cancelarlas o activarlas antes de migrar';
  END IF;
END $$;

-- DropTable
DROP TABLE "TokenCuenta";

-- DropEnum
DROP TYPE "TipoTokenCuenta";

-- AlterTable
ALTER TABLE "Usuario" DROP COLUMN "emailVerificadoEn";

-- AlterEnum: EstadoUsuario sin "pendiente"
CREATE TYPE "EstadoUsuario_new" AS ENUM ('activo', 'inactivo');
ALTER TABLE "Usuario" ALTER COLUMN "estado" TYPE "EstadoUsuario_new" USING ("estado"::text::"EstadoUsuario_new");
ALTER TYPE "EstadoUsuario" RENAME TO "EstadoUsuario_old";
ALTER TYPE "EstadoUsuario_new" RENAME TO "EstadoUsuario";
DROP TYPE "EstadoUsuario_old";
