-- El campo ya no solo marca el último cambio de contraseña: también se marca al
-- desactivar una cuenta (los tokens emitidos antes dejan de valer). Se renombra
-- en vez de borrar y crear, para conservar los valores existentes.
ALTER TABLE "Usuario" RENAME COLUMN "contrasenaCambiadaEn" TO "sesionesValidasDesde";
