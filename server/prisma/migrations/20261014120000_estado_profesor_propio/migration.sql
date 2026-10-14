-- Un profesor solo está activo o inactivo. Hasta ahora la columna usaba el mismo tipo que la cuenta de acceso
-- ("EstadoUsuario"), que desde las invitaciones también admite "pendiente": se separa en un tipo propio.
CREATE TYPE "EstadoProfesor" AS ENUM ('activo', 'inactivo');
ALTER TABLE "Profesor" ALTER COLUMN "estado" DROP DEFAULT;
ALTER TABLE "Profesor" ALTER COLUMN "estado" TYPE "EstadoProfesor" USING ("estado"::text::"EstadoProfesor");
ALTER TABLE "Profesor" ALTER COLUMN "estado" SET DEFAULT 'activo';
