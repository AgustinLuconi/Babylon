-- CreateTable
CREATE TABLE "TokenRecuperacion" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL,
    "expiraEn" TIMESTAMP(3) NOT NULL,
    "usadoEn" TIMESTAMP(3),

    CONSTRAINT "TokenRecuperacion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TokenRecuperacion_hash_key" ON "TokenRecuperacion"("hash");

-- CreateIndex
CREATE INDEX "TokenRecuperacion_usuarioId_creadoEn_idx" ON "TokenRecuperacion"("usuarioId", "creadoEn");

-- AddForeignKey
ALTER TABLE "TokenRecuperacion" ADD CONSTRAINT "TokenRecuperacion_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
