-- CreateEnum
CREATE TYPE "TipoNotificacion" AS ENUM ('cuotas_vencidas', 'documentacion_pendiente', 'evaluacion_proxima', 'asistencia_pendiente', 'notas_sin_publicar', 'cierre_sin_publicar', 'cuota', 'documentacion_hijo', 'nota_publicada', 'cierre_publicado', 'observacion_nueva');

-- CreateEnum
CREATE TYPE "ClaseNotificacion" AS ENUM ('estado', 'evento');

-- CreateEnum
CREATE TYPE "TonoNotificacion" AS ENUM ('danger', 'warning', 'info');

-- CreateTable
CREATE TABLE "Notificacion" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "rol" "Rol" NOT NULL,
    "tipo" "TipoNotificacion" NOT NULL,
    "clase" "ClaseNotificacion" NOT NULL,
    "clave" TEXT NOT NULL,
    "tono" "TonoNotificacion" NOT NULL,
    "texto" TEXT NOT NULL,
    "recurso" JSONB NOT NULL,
    "nivel" INTEGER NOT NULL DEFAULT 0,
    "creadaEn" TIMESTAMP(3) NOT NULL,
    "actualizadaEn" TIMESTAMP(3) NOT NULL,
    "leidaEn" TIMESTAMP(3),
    "resueltaEn" TIMESTAMP(3),

    CONSTRAINT "Notificacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificacionDesactivada" (
    "usuarioId" TEXT NOT NULL,
    "rol" "Rol" NOT NULL,
    "tipo" "TipoNotificacion" NOT NULL,

    CONSTRAINT "NotificacionDesactivada_pkey" PRIMARY KEY ("usuarioId","rol","tipo")
);

-- CreateIndex
CREATE INDEX "Notificacion_usuarioId_rol_resueltaEn_leidaEn_idx" ON "Notificacion"("usuarioId", "rol", "resueltaEn", "leidaEn");

-- CreateIndex
CREATE INDEX "Notificacion_tipo_idx" ON "Notificacion"("tipo");

-- CreateIndex
CREATE INDEX "Notificacion_actualizadaEn_idx" ON "Notificacion"("actualizadaEn");

-- CreateIndex
CREATE UNIQUE INDEX "Notificacion_usuarioId_rol_clave_key" ON "Notificacion"("usuarioId", "rol", "clave");

-- AddForeignKey
ALTER TABLE "Notificacion" ADD CONSTRAINT "Notificacion_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificacionDesactivada" ADD CONSTRAINT "NotificacionDesactivada_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

