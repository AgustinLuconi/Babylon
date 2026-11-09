-- AlterEnum
ALTER TYPE "TipoNotificacion" ADD VALUE 'datos_incompletos';

-- AlterEnum
ALTER TYPE "VinculoPadre" ADD VALUE 'propio';

-- AlterTable: el vínculo con el responsable pasa a ser del alumno; DNI y fecha de nacimiento pueden faltar.
ALTER TABLE "Alumno" ADD COLUMN     "vinculoResponsable" "VinculoPadre",
ALTER COLUMN "dni" DROP NOT NULL,
ALTER COLUMN "fechaNacimiento" DROP NOT NULL;

-- El vínculo que hasta ahora estaba en la ficha del padre se copia a cada alumno que ya tiene padre.
UPDATE "Alumno" a SET "vinculoResponsable" = p."vinculo" FROM "Padre" p WHERE a."padreId" = p."id";

-- AlterTable
ALTER TABLE "Padre" DROP COLUMN "vinculo",
ALTER COLUMN "dni" DROP NOT NULL;
