import { randomUUID } from "node:crypto";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import * as XLSX from "xlsx";
import { importarProfesor, cerrarConexion, type ProfesorImportConfig } from "./importar";

const prisma = new PrismaClient();

// Mapeo confirmado por código de nivel (A1+/A2/B1): Haydeé solo tiene un
// curso por nivel en el maestro, y coincide 1 a 1 con sus 3 archivos de
// "Seguimiento de estudiantes 2025/Haydeé/Nivel <X> - <días y hora>.xlsx".
const config: ProfesorImportConfig = {
  profesorNombre: "Haydeé",
  cursos: [
    {
      sheetName: "HAYDEÉ 1 (Adolescentes)  A2",
      nombre: "A2 (Adolescentes)",
      nivel: "teens_a2",
      horarios: [
        { diaSemana: "lunes", horaInicio: "15:20", horaFin: "16:50" },
        { diaSemana: "miercoles", horaInicio: "15:20", horaFin: "16:50" },
      ],
    },
    {
      sheetName: "HAYDEÉ 2 (Adol. 1417) B1",
      nombre: "B1 (Adolescentes 14-17)",
      nivel: "teens_a2",
      horarios: [
        { diaSemana: "lunes", horaInicio: "16:50", horaFin: "18:20" },
        { diaSemana: "miercoles", horaInicio: "16:50", horaFin: "18:20" },
      ],
    },
    {
      sheetName: "HAYDEÉ 3 (NIÑOS) A1+",
      nombre: "A1+ (Niños)",
      nivel: "kids",
      horarios: [
        { diaSemana: "lunes", horaInicio: "18:30", horaFin: "20:00" },
        { diaSemana: "miercoles", horaInicio: "18:30", horaFin: "20:00" },
      ],
    },
  ],
};

// Presentismo real por clase del grupo de preparación Cambridge — encontrado
// en "Seguimiento de estudiantes 2025/Gustavo/Cambridge 2025.xlsx" (NO en la
// copia homónima de la carpeta de Haydeé, que es un archivo distinto para
// otros dos alumnos —Luca y Franccesca— que no figuran en ninguna de las 19
// hojas del maestro y por lo tanto no se pueden importar sin inventar su
// DNI). Los nombres de este archivo coinciden 100% con el roster real de
// "HAYDEÉ 2 (Adol. 1417) B1", salvo "Ludmila" (pertenece a otra alumna del
// curso de Silvana — se ignora acá para no atribuirle presentismo al curso
// equivocado) e "Ignacio" (nunca aparece nombrado, no parece cursar este
// refuerzo). Ver el resumen final: esta asistencia se asienta bajo el curso
// regular B1 de Haydeé por ser el único curso real de estos alumnos en el
// maestro — podría corresponder en realidad a un refuerzo extra en otro
// horario, no a la clase regular en sí.
const RUTA_CAMBRIDGE = path.join(
  __dirname,
  "fuente",
  "Seguimiento de estudiantes 2025",
  "Gustavo",
  "Cambridge 2025.xlsx",
);

const ALIAS_NOMBRE: Record<string, string> = {
  violeta: "Violeta",
  emilia: "Emilia",
  julieta: "Julieta",
  "juan pedro": "Juan Pedro",
  tiziano: "Tiziano",
  nazareno: "Nazareno",
  naza: "Nazareno",
  lautaro: "Lautaro",
  regina: "Regina",
};

function extraerNombresPresentes(texto: string): string[] {
  const limpio = texto.replace(/una hora por cada uno:/i, "");
  return limpio
    .split(/[,y]/i)
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s && s !== "y" && ALIAS_NOMBRE[s])
    .map((s) => ALIAS_NOMBRE[s]);
}

async function importarAsistenciaCambridge() {
  const cursoB1 = await prisma.curso.findFirst({ where: { nombre: "B1 (Adolescentes 14-17)" } });
  if (!cursoB1) {
    console.log("No se encontró el curso B1 de Haydeé — se omite la asistencia de Cambridge.");
    return;
  }

  const alumnosDelCurso = await prisma.alumno.findMany({ where: { cursoId: cursoB1.id } });

  // Se busca por inclusión (no por primera palabra) porque el nombre real
  // buscado a veces es el segundo término ("María Emilia" -> "Emilia").
  function buscarAlumnoPorNombre(nombreBuscado: string) {
    const buscado = nombreBuscado.toLowerCase();
    return alumnosDelCurso.find((a) => a.nombre.toLowerCase().includes(buscado));
  }

  const workbook = XLSX.readFile(RUTA_CAMBRIDGE, { cellDates: true });
  const filas: unknown[][] = XLSX.utils.sheet_to_json(workbook.Sheets["Hoja 1"], {
    header: 1,
    raw: true,
    defval: null,
  });

  const nombresUnicos = Object.values(ALIAS_NOMBRE).filter((v, i, arr) => arr.indexOf(v) === i);
  const alumnosSeguidos = nombresUnicos
    .map((nombre) => buscarAlumnoPorNombre(nombre))
    .filter((a): a is NonNullable<typeof a> => Boolean(a));

  let registros = 0;
  for (const fila of filas.slice(1)) {
    const fecha = fila[0];
    const asistenciaTexto = fila[3];
    if (!(fecha instanceof Date) || typeof asistenciaTexto !== "string") continue;

    const presentes = new Set(extraerNombresPresentes(asistenciaTexto));

    for (const alumno of alumnosSeguidos) {
      const nombreAlias = nombresUnicos.find((n) => alumno.nombre.toLowerCase().includes(n.toLowerCase()))!;
      const estuvoPresente = presentes.has(nombreAlias);
      await prisma.asistencia.upsert({
        where: { alumnoId_cursoId_fecha: { alumnoId: alumno.id, cursoId: cursoB1.id, fecha } },
        update: {},
        create: {
          id: randomUUID(),
          alumnoId: alumno.id,
          cursoId: cursoB1.id,
          fecha,
          estado: estuvoPresente ? "presente" : "ausente",
        },
      });
      registros++;
    }
  }

  console.log(`Asistencia real de Cambridge importada: ${registros} registros sobre ${alumnosSeguidos.length} alumnos.`);
}

importarProfesor(config)
  .then(async (resumen) => {
    console.log(JSON.stringify(resumen, null, 2));
    await importarAsistenciaCambridge();
  })
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await cerrarConexion();
    await prisma.$disconnect();
  });
