-- Las sesiones pasan de "válidas desde un momento" (que dejaba pasar los tokens emitidos en el mismo
-- segundo del cambio) a una versión por cuenta: el token lleva la versión con la que se emitió y deja de
-- valer cuando la cuenta la incrementa (cambio de contraseña o desactivación).
ALTER TABLE "Usuario" ADD COLUMN "versionSesion" INTEGER NOT NULL DEFAULT 0;
-- Las cuentas que ya tenían sesiones invalidadas pasan a la versión 1: los tokens viejos (versión 0) siguen sin valer.
UPDATE "Usuario" SET "versionSesion" = 1 WHERE "sesionesValidasDesde" IS NOT NULL;
ALTER TABLE "Usuario" DROP COLUMN "sesionesValidasDesde";
