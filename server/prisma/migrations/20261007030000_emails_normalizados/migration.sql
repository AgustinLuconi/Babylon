-- Los emails de las cuentas se guardan sin espacios y en minúsculas, y se buscan por igualdad
-- exacta (antes se buscaban con ILIKE, donde "_" y "%" funcionan como comodines). Esto normaliza
-- las filas existentes; si dos cuentas difirieran solo en mayúsculas, el índice único falla a
-- propósito y hay que resolverlo a mano antes de seguir.
UPDATE "Usuario" SET "email" = lower(trim("email")) WHERE "email" <> lower(trim("email"));
