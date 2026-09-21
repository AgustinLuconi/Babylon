-- DropForeignKey
ALTER TABLE "Padre" DROP CONSTRAINT "Padre_usuarioId_fkey";

-- AlterTable
ALTER TABLE "Curso" ADD COLUMN     "cicloId" TEXT;

-- AlterTable
ALTER TABLE "Padre" ALTER COLUMN "usuarioId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "Ciclo" (
    "id" TEXT NOT NULL,
    "anio" INTEGER NOT NULL,
    "activo" BOOLEAN NOT NULL,

    CONSTRAINT "Ciclo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Inscripcion" (
    "id" TEXT NOT NULL,
    "alumnoId" TEXT NOT NULL,
    "cursoId" TEXT NOT NULL,
    "cicloId" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "aplicaDescuentoHermanos" BOOLEAN NOT NULL,

    CONSTRAINT "Inscripcion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Ciclo_anio_key" ON "Ciclo"("anio");

-- CreateIndex
CREATE UNIQUE INDEX "Inscripcion_alumnoId_cicloId_key" ON "Inscripcion"("alumnoId", "cicloId");

-- AddForeignKey
ALTER TABLE "Padre" ADD CONSTRAINT "Padre_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Curso" ADD CONSTRAINT "Curso_cicloId_fkey" FOREIGN KEY ("cicloId") REFERENCES "Ciclo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inscripcion" ADD CONSTRAINT "Inscripcion_alumnoId_fkey" FOREIGN KEY ("alumnoId") REFERENCES "Alumno"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inscripcion" ADD CONSTRAINT "Inscripcion_cursoId_fkey" FOREIGN KEY ("cursoId") REFERENCES "Curso"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inscripcion" ADD CONSTRAINT "Inscripcion_cicloId_fkey" FOREIGN KEY ("cicloId") REFERENCES "Ciclo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
