-- Las notas son solo numéricas: se quita la escala de las evaluaciones.
-- Guarda: si todavía queda una evaluación conceptual o una nota de cierre que no sea un número, la migración se detiene en
-- vez de dejar esos datos sin su escala (hay que corregirlos o borrarlos a mano antes).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "Evaluacion" WHERE "escala" = 'conceptual') THEN
    RAISE EXCEPTION 'Quedan evaluaciones con escala conceptual: hay que borrarlas o pasarlas a notas numéricas antes de migrar';
  END IF;
  IF EXISTS (SELECT 1 FROM "NotaCierre" WHERE "nota" !~ '^[0-9]+([.,][0-9]+)?$') THEN
    RAISE EXCEPTION 'Quedan notas de cierre que no son numéricas: hay que corregirlas antes de migrar';
  END IF;
END $$;

-- AlterTable
ALTER TABLE "Evaluacion" DROP COLUMN "escala";

-- DropEnum
DROP TYPE "EscalaEvaluacion";
