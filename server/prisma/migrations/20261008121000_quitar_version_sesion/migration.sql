-- Las sesiones pasan a la tabla "Sesion" (una por dispositivo): el contador por cuenta ya no se usa. Los tokens
-- emitidos antes de este cambio no llevan el id de sesión y dejan de valer: hay que iniciar sesión de nuevo.
ALTER TABLE "Usuario" DROP COLUMN "versionSesion";
