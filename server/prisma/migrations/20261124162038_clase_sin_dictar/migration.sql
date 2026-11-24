-- CreateTable
CREATE TABLE "ClaseSinDictar" (
    "id" TEXT NOT NULL,
    "cursoId" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "motivo" TEXT,
    "registradaPor" TEXT NOT NULL,
    "creadaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClaseSinDictar_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ClaseSinDictar_cursoId_idx" ON "ClaseSinDictar"("cursoId");

-- CreateIndex
CREATE UNIQUE INDEX "ClaseSinDictar_cursoId_fecha_key" ON "ClaseSinDictar"("cursoId", "fecha");

-- AddForeignKey
ALTER TABLE "ClaseSinDictar" ADD CONSTRAINT "ClaseSinDictar_cursoId_fkey" FOREIGN KEY ("cursoId") REFERENCES "Curso"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
