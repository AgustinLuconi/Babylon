-- CreateTable
CREATE TABLE "Automatizacion" (
    "regla" TEXT NOT NULL,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "umbral" INTEGER NOT NULL,
    "ultimaRevisionEn" TIMESTAMP(3),

    CONSTRAINT "Automatizacion_pkey" PRIMARY KEY ("regla")
);

-- CreateTable
CREATE TABLE "AlertaAutomatica" (
    "id" TEXT NOT NULL,
    "regla" TEXT NOT NULL,
    "alumnoId" TEXT NOT NULL,
    "cursoId" TEXT,
    "nivel" INTEGER NOT NULL,
    "abiertaEn" TIMESTAMP(3) NOT NULL,
    "resueltaEn" TIMESTAMP(3),
    "motivoCierre" TEXT,

    CONSTRAINT "AlertaAutomatica_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AlertaAutomatica_regla_resueltaEn_idx" ON "AlertaAutomatica"("regla", "resueltaEn");

-- CreateIndex
CREATE INDEX "AlertaAutomatica_alumnoId_idx" ON "AlertaAutomatica"("alumnoId");

-- AddForeignKey
ALTER TABLE "AlertaAutomatica" ADD CONSTRAINT "AlertaAutomatica_alumnoId_fkey" FOREIGN KEY ("alumnoId") REFERENCES "Alumno"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertaAutomatica" ADD CONSTRAINT "AlertaAutomatica_cursoId_fkey" FOREIGN KEY ("cursoId") REFERENCES "Curso"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- A lo sumo una alerta abierta por regla, alumno y curso (los dos revisores simultáneos no pueden abrir la misma).
CREATE UNIQUE INDEX "AlertaAutomatica_abierta_key" ON "AlertaAutomatica" ("regla", "alumnoId", COALESCE("cursoId", '')) WHERE "resueltaEn" IS NULL;
