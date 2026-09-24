-- Se quita "tarjeta" de MetodoPago (el instituto no cobra con tarjeta).
-- Cualquier pago que la usara pasa a "otro" para no perder el registro.
UPDATE "Pago" SET "metodo" = 'otro' WHERE "metodo" = 'tarjeta';

-- Postgres no permite borrar un valor de un enum: se recrea el tipo.
CREATE TYPE "MetodoPago_new" AS ENUM ('efectivo', 'transferencia', 'mercadopago', 'otro');
ALTER TABLE "Pago" ALTER COLUMN "metodo" TYPE "MetodoPago_new" USING ("metodo"::text::"MetodoPago_new");
ALTER TYPE "MetodoPago" RENAME TO "MetodoPago_old";
ALTER TYPE "MetodoPago_new" RENAME TO "MetodoPago";
DROP TYPE "MetodoPago_old";
