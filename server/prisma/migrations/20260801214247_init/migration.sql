-- CreateEnum
CREATE TYPE "Rol" AS ENUM ('admin', 'secretario', 'profesor', 'padre');

-- CreateEnum
CREATE TYPE "EstadoUsuario" AS ENUM ('activo', 'inactivo');

-- CreateEnum
CREATE TYPE "VinculoPadre" AS ENUM ('padre', 'madre', 'tutor');

-- CreateEnum
CREATE TYPE "EstadoAlumno" AS ENUM ('activo', 'inactivo', 'egresado');

-- CreateEnum
CREATE TYPE "NivelCurso" AS ENUM ('kids', 'teens_a1', 'teens_a2', 'adults_b1', 'adults_b2', 'cambridge_prep');

-- CreateEnum
CREATE TYPE "EstadoCurso" AS ENUM ('activo', 'inactivo');

-- CreateEnum
CREATE TYPE "DiaSemana" AS ENUM ('lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado');

-- CreateEnum
CREATE TYPE "EstadoAsistencia" AS ENUM ('presente', 'tarde', 'ausente');

-- CreateEnum
CREATE TYPE "EstadoCuota" AS ENUM ('pendiente', 'pagada', 'vencida');

-- CreateEnum
CREATE TYPE "MetodoPago" AS ENUM ('efectivo', 'transferencia', 'tarjeta');

-- CreateEnum
CREATE TYPE "TipoDocumento" AS ENUM ('formulario_inscripcion', 'copia_dni', 'autorizacion_imagen');

-- CreateEnum
CREATE TYPE "EstadoDocumento" AS ENUM ('pendiente', 'cargado', 'autorizado', 'revocado');

-- CreateEnum
CREATE TYPE "TipoAutorizacion" AS ENUM ('digital', 'manual');

-- CreateEnum
CREATE TYPE "TipoEvaluacion" AS ENUM ('examen', 'trabajo_practico', 'oral', 'proyecto');

-- CreateEnum
CREATE TYPE "PeriodoAcademico" AS ENUM ('julio', 'noviembre');

-- CreateEnum
CREATE TYPE "EscalaEvaluacion" AS ENUM ('numerica', 'conceptual');

-- CreateEnum
CREATE TYPE "EstadoEvaluacion" AS ENUM ('borrador', 'publicada');

-- CreateTable
CREATE TABLE "Usuario" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "roles" "Rol"[],
    "estado" "EstadoUsuario" NOT NULL,
    "fechaCreacion" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Padre" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "apellido" TEXT NOT NULL,
    "dni" TEXT NOT NULL,
    "telefono" TEXT,
    "email" TEXT NOT NULL,
    "vinculo" "VinculoPadre" NOT NULL,
    "usuarioId" TEXT NOT NULL,

    CONSTRAINT "Padre_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Profesor" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "apellido" TEXT NOT NULL,
    "dni" TEXT NOT NULL,
    "telefono" TEXT,
    "email" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,

    CONSTRAINT "Profesor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Alumno" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "apellido" TEXT NOT NULL,
    "dni" TEXT NOT NULL,
    "fechaNacimiento" TIMESTAMP(3) NOT NULL,
    "direccion" TEXT,
    "telefono" TEXT,
    "email" TEXT,
    "foto" TEXT,
    "observacionesMedicas" TEXT,
    "fechaInscripcion" TIMESTAMP(3) NOT NULL,
    "estado" "EstadoAlumno" NOT NULL,
    "padreId" TEXT NOT NULL,
    "cursoId" TEXT,
    "aplicaDescuentoHermanos" BOOLEAN NOT NULL,

    CONSTRAINT "Alumno_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Curso" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "nivel" "NivelCurso" NOT NULL,
    "profesorId" TEXT NOT NULL,
    "aula" TEXT,
    "cupo" INTEGER NOT NULL,
    "estado" "EstadoCurso" NOT NULL,

    CONSTRAINT "Curso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Horario" (
    "id" TEXT NOT NULL,
    "cursoId" TEXT NOT NULL,
    "diaSemana" "DiaSemana" NOT NULL,
    "horaInicio" TEXT NOT NULL,
    "horaFin" TEXT NOT NULL,

    CONSTRAINT "Horario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Asistencia" (
    "id" TEXT NOT NULL,
    "alumnoId" TEXT NOT NULL,
    "cursoId" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "estado" "EstadoAsistencia" NOT NULL,
    "minutosRetraso" INTEGER,
    "motivo" TEXT,

    CONSTRAINT "Asistencia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cuota" (
    "id" TEXT NOT NULL,
    "alumnoId" TEXT NOT NULL,
    "mes" INTEGER NOT NULL,
    "anio" INTEGER NOT NULL,
    "montoBase" DOUBLE PRECISION NOT NULL,
    "descuento" DOUBLE PRECISION NOT NULL,
    "montoFinal" DOUBLE PRECISION NOT NULL,
    "vencimiento" TIMESTAMP(3) NOT NULL,
    "estado" "EstadoCuota" NOT NULL,

    CONSTRAINT "Cuota_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pago" (
    "id" TEXT NOT NULL,
    "cuotaId" TEXT NOT NULL,
    "fechaPago" TIMESTAMP(3) NOT NULL,
    "metodo" "MetodoPago" NOT NULL,
    "monto" DOUBLE PRECISION NOT NULL,
    "registradoPor" TEXT NOT NULL,

    CONSTRAINT "Pago_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Documento" (
    "id" TEXT NOT NULL,
    "alumnoId" TEXT NOT NULL,
    "tipo" "TipoDocumento" NOT NULL,
    "estado" "EstadoDocumento" NOT NULL,
    "urlArchivo" TEXT,
    "fechaCarga" TIMESTAMP(3),
    "autorizadoPor" TEXT,
    "fechaAutorizacion" TIMESTAMP(3),
    "tipoAutorizacion" "TipoAutorizacion",

    CONSTRAINT "Documento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Evaluacion" (
    "id" TEXT NOT NULL,
    "cursoId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" "TipoEvaluacion" NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "periodo" "PeriodoAcademico" NOT NULL,
    "escala" "EscalaEvaluacion" NOT NULL,
    "estado" "EstadoEvaluacion" NOT NULL,

    CONSTRAINT "Evaluacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Calificacion" (
    "id" TEXT NOT NULL,
    "evaluacionId" TEXT NOT NULL,
    "alumnoId" TEXT NOT NULL,
    "nota" TEXT NOT NULL,
    "observacion" TEXT,

    CONSTRAINT "Calificacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotaCierre" (
    "id" TEXT NOT NULL,
    "alumnoId" TEXT NOT NULL,
    "cursoId" TEXT NOT NULL,
    "periodo" "PeriodoAcademico" NOT NULL,
    "nota" TEXT NOT NULL,
    "observacion" TEXT,
    "estado" "EstadoEvaluacion" NOT NULL,

    CONSTRAINT "NotaCierre_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Observacion" (
    "id" TEXT NOT NULL,
    "alumnoId" TEXT NOT NULL,
    "emisorId" TEXT NOT NULL,
    "emisorRol" "Rol" NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "texto" TEXT NOT NULL,
    "categoria" TEXT NOT NULL,

    CONSTRAINT "Observacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CategoriaPersonalizada" (
    "id" TEXT NOT NULL,
    "cursoId" TEXT NOT NULL,
    "profesorId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,

    CONSTRAINT "CategoriaPersonalizada_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Chat" (
    "id" TEXT NOT NULL,
    "padreId" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Chat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Mensaje" (
    "id" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "emisorId" TEXT NOT NULL,
    "rolEmisor" "Rol" NOT NULL,
    "texto" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Mensaje_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Padre_dni_key" ON "Padre"("dni");

-- CreateIndex
CREATE UNIQUE INDEX "Padre_usuarioId_key" ON "Padre"("usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "Profesor_dni_key" ON "Profesor"("dni");

-- CreateIndex
CREATE UNIQUE INDEX "Profesor_usuarioId_key" ON "Profesor"("usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "Alumno_dni_key" ON "Alumno"("dni");

-- CreateIndex
CREATE UNIQUE INDEX "Asistencia_alumnoId_cursoId_fecha_key" ON "Asistencia"("alumnoId", "cursoId", "fecha");

-- CreateIndex
CREATE UNIQUE INDEX "Pago_cuotaId_key" ON "Pago"("cuotaId");

-- CreateIndex
CREATE UNIQUE INDEX "Documento_alumnoId_tipo_key" ON "Documento"("alumnoId", "tipo");

-- CreateIndex
CREATE UNIQUE INDEX "Calificacion_evaluacionId_alumnoId_key" ON "Calificacion"("evaluacionId", "alumnoId");

-- CreateIndex
CREATE UNIQUE INDEX "NotaCierre_alumnoId_cursoId_periodo_key" ON "NotaCierre"("alumnoId", "cursoId", "periodo");

-- CreateIndex
CREATE UNIQUE INDEX "Chat_padreId_key" ON "Chat"("padreId");

-- AddForeignKey
ALTER TABLE "Padre" ADD CONSTRAINT "Padre_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Profesor" ADD CONSTRAINT "Profesor_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alumno" ADD CONSTRAINT "Alumno_padreId_fkey" FOREIGN KEY ("padreId") REFERENCES "Padre"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alumno" ADD CONSTRAINT "Alumno_cursoId_fkey" FOREIGN KEY ("cursoId") REFERENCES "Curso"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Curso" ADD CONSTRAINT "Curso_profesorId_fkey" FOREIGN KEY ("profesorId") REFERENCES "Profesor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Horario" ADD CONSTRAINT "Horario_cursoId_fkey" FOREIGN KEY ("cursoId") REFERENCES "Curso"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asistencia" ADD CONSTRAINT "Asistencia_alumnoId_fkey" FOREIGN KEY ("alumnoId") REFERENCES "Alumno"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asistencia" ADD CONSTRAINT "Asistencia_cursoId_fkey" FOREIGN KEY ("cursoId") REFERENCES "Curso"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cuota" ADD CONSTRAINT "Cuota_alumnoId_fkey" FOREIGN KEY ("alumnoId") REFERENCES "Alumno"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pago" ADD CONSTRAINT "Pago_cuotaId_fkey" FOREIGN KEY ("cuotaId") REFERENCES "Cuota"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Documento" ADD CONSTRAINT "Documento_alumnoId_fkey" FOREIGN KEY ("alumnoId") REFERENCES "Alumno"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evaluacion" ADD CONSTRAINT "Evaluacion_cursoId_fkey" FOREIGN KEY ("cursoId") REFERENCES "Curso"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Calificacion" ADD CONSTRAINT "Calificacion_evaluacionId_fkey" FOREIGN KEY ("evaluacionId") REFERENCES "Evaluacion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Calificacion" ADD CONSTRAINT "Calificacion_alumnoId_fkey" FOREIGN KEY ("alumnoId") REFERENCES "Alumno"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotaCierre" ADD CONSTRAINT "NotaCierre_alumnoId_fkey" FOREIGN KEY ("alumnoId") REFERENCES "Alumno"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotaCierre" ADD CONSTRAINT "NotaCierre_cursoId_fkey" FOREIGN KEY ("cursoId") REFERENCES "Curso"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Observacion" ADD CONSTRAINT "Observacion_alumnoId_fkey" FOREIGN KEY ("alumnoId") REFERENCES "Alumno"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CategoriaPersonalizada" ADD CONSTRAINT "CategoriaPersonalizada_cursoId_fkey" FOREIGN KEY ("cursoId") REFERENCES "Curso"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CategoriaPersonalizada" ADD CONSTRAINT "CategoriaPersonalizada_profesorId_fkey" FOREIGN KEY ("profesorId") REFERENCES "Profesor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Chat" ADD CONSTRAINT "Chat_padreId_fkey" FOREIGN KEY ("padreId") REFERENCES "Padre"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mensaje" ADD CONSTRAINT "Mensaje_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "Chat"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
