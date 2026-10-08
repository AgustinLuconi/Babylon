-- CreateTable
CREATE TABLE "Sesion" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "dispositivo" TEXT NOT NULL,
    "ip" TEXT,
    "creadaEn" TIMESTAMP(3) NOT NULL,
    "ultimoUsoEn" TIMESTAMP(3) NOT NULL,
    "expiraEn" TIMESTAMP(3) NOT NULL,
    "cerradaEn" TIMESTAMP(3),

    CONSTRAINT "Sesion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Sesion_usuarioId_cerradaEn_expiraEn_idx" ON "Sesion"("usuarioId", "cerradaEn", "expiraEn");

-- AddForeignKey
ALTER TABLE "Sesion" ADD CONSTRAINT "Sesion_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
