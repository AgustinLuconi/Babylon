-- AlterEnum
BEGIN;
CREATE TYPE "EstadoCuota_new" AS ENUM ('pagada', 'vencida');
ALTER TABLE "Cuota" ALTER COLUMN "estado" TYPE "EstadoCuota_new" USING ("estado"::text::"EstadoCuota_new");
ALTER TYPE "EstadoCuota" RENAME TO "EstadoCuota_old";
ALTER TYPE "EstadoCuota_new" RENAME TO "EstadoCuota";
DROP TYPE "EstadoCuota_old";
COMMIT;
