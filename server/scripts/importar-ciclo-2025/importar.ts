import { randomUUID } from "node:crypto";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import * as XLSX from "xlsx";
import { parseRoster } from "./parseRoster";
import { mapearDocumentacion } from "./documentacion";

const prisma = new PrismaClient();
const RUTA_MAESTRO = path.join(__dirname, "fuente", " Ciclo 2025_.xlsx");

export interface HorarioConfig {
  diaSemana: "lunes" | "martes" | "miercoles" | "jueves" | "viernes" | "sabado";
  horaInicio: string;
  horaFin: string;
}

export interface CursoConfig {
  sheetName: string;
  nombre: string;
  nivel: "kids" | "teens_a1" | "teens_a2" | "adults_b1" | "adults_b2" | "cambridge_prep";
  horarios: HorarioConfig[];
}

export interface ProfesorImportConfig {
  profesorNombre: string;
  // Opcional: de los profesores importados, solo se confirmó el apellido
  // real de uno. El resto queda con el nombre de pila únicamente hasta
  // que se consiga el dato real.
  profesorApellido?: string;
  cursos: CursoConfig[];
}

export interface ResumenImport {
  profesor: string;
  cursosCreados: number;
  cursosYaExistian: number;
  alumnosCreados: number;
  alumnosExistentesSalteados: number;
  alumnosSinDni: number;
  alumnosSinFechaNacimiento: { curso: string; alumno: string; dni: string }[];
  documentosAmbiguos: { curso: string; alumno: string; textoOriginal: string }[];
}

// Proxy institucional (no individual): el ciclo lectivo real arranca en
// marzo, y la fuente no trae una fecha de inscripción por alumno — se usa
// como aproximación razonable, no como un dato verificado por alumno.
const FECHA_INICIO_CICLO_2025 = new Date(2025, 2, 1);

async function asegurarCiclo2025() {
  let ciclo = await prisma.ciclo.findUnique({ where: { anio: 2025 } });
  if (!ciclo) {
    ciclo = await prisma.ciclo.create({ data: { id: randomUUID(), anio: 2025, activo: false } });
    console.log("Ciclo 2025 creado (histórico, no activo)");
  }
  return ciclo;
}

async function asegurarProfesor(nombre: string, apellido?: string) {
  let profesor = await prisma.profesor.findFirst({
    where: apellido
      ? { nombre: { equals: nombre, mode: "insensitive" }, apellido: { equals: apellido, mode: "insensitive" } }
      : { nombre: { equals: nombre, mode: "insensitive" } },
  });
  if (!profesor) {
    profesor = await prisma.profesor.create({ data: { id: randomUUID(), nombre, apellido } });
    console.log(
      `Profesor creado SIN cuenta de acceso (falta DNI y email real${apellido ? "" : ", y apellido"}): ${nombre} ${apellido ?? ""}`,
    );
  }
  return profesor;
}

export async function importarProfesor(config: ProfesorImportConfig): Promise<ResumenImport> {
  const workbook = XLSX.readFile(RUTA_MAESTRO, { cellDates: true });
  const ciclo2025 = await asegurarCiclo2025();
  const profesor = await asegurarProfesor(config.profesorNombre, config.profesorApellido);

  const resumen: ResumenImport = {
    profesor: config.profesorApellido ? `${config.profesorNombre} ${config.profesorApellido}` : config.profesorNombre,
    cursosCreados: 0,
    cursosYaExistian: 0,
    alumnosCreados: 0,
    alumnosExistentesSalteados: 0,
    alumnosSinDni: 0,
    alumnosSinFechaNacimiento: [],
    documentosAmbiguos: [],
  };

  for (const cursoConfig of config.cursos) {
    const roster = parseRoster(workbook, cursoConfig.sheetName);

    let curso = await prisma.curso.findFirst({
      where: { nombre: cursoConfig.nombre, profesorId: profesor.id, cicloId: ciclo2025.id },
    });
    if (!curso) {
      curso = await prisma.curso.create({
        data: {
          id: randomUUID(),
          nombre: cursoConfig.nombre,
          nivel: cursoConfig.nivel,
          profesorId: profesor.id,
          cicloId: ciclo2025.id,
          // No hay cupo declarado en la fuente 2025 — se usa la cantidad
          // real de alumnos del roster (el único número no inventado).
          cupo: roster.length,
          // El ciclo 2025 ya cerró.
          estado: "inactivo",
        },
      });
      resumen.cursosCreados++;
      for (const horario of cursoConfig.horarios) {
        await prisma.horario.create({ data: { id: randomUUID(), cursoId: curso.id, ...horario } });
      }
    } else {
      resumen.cursosYaExistian++;
    }

    for (const fila of roster) {
      if (!fila.dni) {
        resumen.alumnosSinDni++;
        continue;
      }
      const existente = await prisma.alumno.findUnique({ where: { dni: fila.dni } });
      if (existente) {
        resumen.alumnosExistentesSalteados++;
        continue;
      }

      if (!fila.fechaNacimiento) {
        resumen.alumnosSinFechaNacimiento.push({
          curso: cursoConfig.nombre,
          alumno: `${fila.apellido}, ${fila.nombre}`,
          dni: fila.dni,
        });
        continue;
      }

      const alumno = await prisma.alumno.create({
        data: {
          id: randomUUID(),
          nombre: fila.nombre || fila.apellido,
          apellido: fila.apellido,
          dni: fila.dni,
          fechaNacimiento: fila.fechaNacimiento,
          telefono: fila.telefono,
          fechaInscripcion: FECHA_INICIO_CICLO_2025,
          // Insc. 2026 marcada -> siguió en el instituto; si no, se marca
          // inactivo (no "egresado": no hay forma de saber si egresó del
          // programa o simplemente no continuó).
          estado: fila.insc2026 ? "activo" : "inactivo",
          cursoId: curso.id,
          // Sin padre vinculado no se puede calcular hermanos reales.
          aplicaDescuentoHermanos: false,
        },
      });
      resumen.alumnosCreados++;

      await prisma.inscripcion.create({
        data: {
          id: randomUUID(),
          alumnoId: alumno.id,
          cursoId: curso.id,
          cicloId: ciclo2025.id,
          fecha: FECHA_INICIO_CICLO_2025,
          aplicaDescuentoHermanos: false,
        },
      });

      const doc = mapearDocumentacion(fila.documentacionTexto);
      if (doc.ambiguo) {
        resumen.documentosAmbiguos.push({
          curso: cursoConfig.nombre,
          alumno: `${fila.apellido}, ${fila.nombre}`,
          textoOriginal: fila.documentacionTexto ?? "",
        });
      }

      await prisma.documento.create({
        data: {
          id: randomUUID(),
          alumnoId: alumno.id,
          tipo: "formulario_inscripcion",
          estado: doc.formularioCompleto ? "cargado" : "pendiente",
          fechaCarga: doc.formularioCompleto ? FECHA_INICIO_CICLO_2025 : null,
        },
      });
      await prisma.documento.create({
        data: {
          id: randomUUID(),
          alumnoId: alumno.id,
          tipo: "copia_dni",
          estado: doc.dniCompleto ? "cargado" : "pendiente",
          fechaCarga: doc.dniCompleto ? FECHA_INICIO_CICLO_2025 : null,
        },
      });
      await prisma.documento.create({
        data: {
          id: randomUUID(),
          alumnoId: alumno.id,
          tipo: "autorizacion_imagen",
          estado: doc.imagenCompleta ? "autorizado" : "pendiente",
          // Sin padre vinculado no se puede asentar quién la autorizó.
          fechaAutorizacion: doc.imagenCompleta ? FECHA_INICIO_CICLO_2025 : null,
          tipoAutorizacion: doc.imagenCompleta ? "manual" : null,
        },
      });
    }
  }

  return resumen;
}

export async function cerrarConexion() {
  await prisma.$disconnect();
}
