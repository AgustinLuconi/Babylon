// Datos de PRUEBA para el ciclo lectivo activo (2026) — para poder revisar
// pantallas con tablas llenas, estados de cuota, asistencia, notas, chats, etc.
//
// Todo lo que crea lleva el prefijo "prueba-" en su `id`, así el modo `borrar`
// lo elimina sin tocar nada real (los datos reales están en el ciclo 2025).
//
//   pnpm exec tsx scripts/datos-prueba-2026.ts crear    (borra y recrea)
//   pnpm exec tsx scripts/datos-prueba-2026.ts borrar
//
// Cuentas de prueba: p1..p6@prueba.babylon.test, contraseña "prueba1234".
import bcrypt from "bcrypt";
import { PrismaClient, type EstadoCuota, type MetodoPago, type Rol } from "@prisma/client";

const prisma = new PrismaClient();
const P = "prueba-";

// ---------- utilidades ----------
let semilla = 20260923;
const azar = () => {
  semilla = (semilla * 1664525 + 1013904223) % 4294967296;
  return semilla / 4294967296;
};
const elegir = <T>(xs: T[]): T => xs[Math.floor(azar() * xs.length)];
const utc = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d));

// ---------- borrado ----------
async function borrar() {
  const w = { where: { id: { startsWith: P } } };
  await prisma.mensaje.deleteMany(w);
  await prisma.chat.deleteMany(w);
  await prisma.observacion.deleteMany(w);
  await prisma.categoriaPersonalizada.deleteMany(w);
  await prisma.documento.deleteMany(w);
  await prisma.calificacion.deleteMany(w);
  await prisma.notaCierre.deleteMany(w);
  await prisma.evaluacion.deleteMany(w);
  await prisma.pago.deleteMany(w);
  await prisma.cuota.deleteMany(w);
  await prisma.asistencia.deleteMany(w);
  await prisma.inscripcion.deleteMany(w);
  await prisma.horario.deleteMany(w);
  await prisma.alumno.deleteMany(w);
  await prisma.curso.deleteMany(w);
  await prisma.padre.deleteMany(w);
  await prisma.usuario.deleteMany(w);
}

// ---------- datos ----------
const DIAS = { lunes: 1, martes: 2, miercoles: 3, jueves: 4, viernes: 5, sabado: 6 } as const;
type Dia = keyof typeof DIAS;

const CURSOS: {
  n: number; nombre: string; nivel: "kids" | "teens_a1" | "teens_a2" | "adults_b2" | "cambridge_prep";
  prof: "martin" | "silvana"; aula: string; cupo: number; base: number;
  horarios: { d: Dia; ini: string; fin: string }[];
}[] = [
  { n: 1, nombre: "Kids Inicial", nivel: "kids", prof: "martin", aula: "1", cupo: 20, base: 30000, horarios: [{ d: "lunes", ini: "16:00", fin: "17:00" }, { d: "miercoles", ini: "16:00", fin: "17:00" }] },
  { n: 2, nombre: "Teens A1", nivel: "teens_a1", prof: "martin", aula: "2", cupo: 20, base: 35000, horarios: [{ d: "lunes", ini: "18:00", fin: "19:30" }, { d: "miercoles", ini: "18:00", fin: "19:30" }] },
  { n: 3, nombre: "Teens A2", nivel: "teens_a2", prof: "martin", aula: "2", cupo: 20, base: 35000, horarios: [{ d: "martes", ini: "18:30", fin: "20:00" }, { d: "jueves", ini: "18:30", fin: "20:00" }] },
  { n: 4, nombre: "Adults B2", nivel: "adults_b2", prof: "silvana", aula: "3", cupo: 15, base: 40000, horarios: [{ d: "martes", ini: "19:30", fin: "21:00" }, { d: "jueves", ini: "19:30", fin: "21:00" }] },
  { n: 5, nombre: "Cambridge Prep", nivel: "cambridge_prep", prof: "silvana", aula: "3", cupo: 12, base: 45000, horarios: [{ d: "sabado", ini: "10:00", fin: "12:00" }] },
];

// [nombre, apellido, curso, padre(1..10), vinculo padre]
const ALUMNOS: [string, string, number, number][] = [
  ["Mateo", "Rodríguez", 1, 1], ["Lucía", "Rodríguez", 1, 1], ["Julieta", "Ferreyra", 1, 2], ["Bautista", "Acosta", 1, 3],
  ["Sofía", "Méndez", 2, 4], ["Tomás", "Méndez", 2, 4], ["Camila", "Bustos", 2, 5], ["Joaquín", "Ledesma", 2, 6],
  ["Valentino", "Quiroga", 3, 7], ["Martina", "Sosa", 3, 8], ["Ignacio", "Paz", 3, 9],
  ["Florencia", "Herrera", 4, 10], ["Agustín", "Molina", 4, 10], ["Renata", "Vega", 4, 11],
  ["Emiliano", "Correa", 5, 12], ["Abril", "Navarro", 5, 13],
];
const PADRES: [string, string, "padre" | "madre" | "tutor"][] = [
  ["Carlos", "Rodríguez", "padre"], ["Laura", "Ferreyra", "madre"], ["Marcela", "Acosta", "madre"], ["Gustavo", "Méndez", "padre"],
  ["Silvia", "Bustos", "madre"], ["Hugo", "Ledesma", "padre"], ["Ana", "Quiroga", "tutor"], ["Patricia", "Sosa", "madre"],
  ["Roberto", "Paz", "padre"], ["Mónica", "Herrera", "madre"], ["Diego", "Vega", "padre"], ["Claudia", "Correa", "madre"], ["Fabián", "Navarro", "padre"],
];
// Alumnos que se inscribieron este mes (índices) y morosos.
const NUEVOS = new Set([14, 15]);
const MOROSOS_2 = new Set([3, 7, 10, 13]); // deben agosto y septiembre
const MOROSOS_1 = new Set([5, 11]); // deben septiembre
const HOY = utc(2026, 9, 23);

async function crear() {
  await borrar();
  const hash = await bcrypt.hash("prueba1234", 10);

  const silvanaProf = await prisma.profesor.findFirstOrThrow({ where: { email: "admin@babylon.test" } });
  const martinProf = await prisma.profesor.findFirstOrThrow({ where: { email: "profesor@babylon.test" } });
  const admin = await prisma.usuario.findFirstOrThrow({ where: { email: "admin@babylon.test" } });
  const secretario = await prisma.usuario.findFirstOrThrow({ where: { email: "secretario@babylon.test" } });
  const martinUser = await prisma.usuario.findFirstOrThrow({ where: { email: "profesor@babylon.test" } });
  const ciclo = await prisma.ciclo.findFirstOrThrow({ where: { activo: true } });

  // Padres (los 6 primeros con cuenta de acceso)
  for (let i = 0; i < PADRES.length; i++) {
    const [nombre, apellido, vinculo] = PADRES[i];
    const n = i + 1;
    let usuarioId: string | undefined;
    if (n <= 6) {
      usuarioId = `${P}usuario-${n}`;
      await prisma.usuario.create({
        data: { id: usuarioId, nombre: `${nombre} ${apellido}`, email: `p${n}@prueba.babylon.test`, passwordHash: hash, roles: ["padre"], estado: "activo", fechaCreacion: utc(2026, 3, 1) },
      });
    }
    await prisma.padre.create({
      data: {
        id: `${P}padre-${n}`, nombre, apellido, dni: `800000${String(n).padStart(2, "0")}`,
        direccion: `Calle ${100 + n * 7}, San Luis`, telefono: `2664-55${String(n).padStart(4, "0")}`,
        email: n <= 6 ? `p${n}@prueba.babylon.test` : undefined, vinculo, usuarioId,
      },
    });
  }

  // Cursos + horarios
  for (const c of CURSOS) {
    await prisma.curso.create({
      data: { id: `${P}curso-${c.n}`, nombre: c.nombre, nivel: c.nivel, profesorId: c.prof === "martin" ? martinProf.id : silvanaProf.id, cicloId: ciclo.id, aula: c.aula, cupo: c.cupo, estado: "activo" },
    });
    for (const [i, h] of c.horarios.entries()) {
      await prisma.horario.create({ data: { id: `${P}horario-${c.n}-${i}`, cursoId: `${P}curso-${c.n}`, diaSemana: h.d, horaInicio: h.ini, horaFin: h.fin } });
    }
  }

  // Alumnos + inscripción + documentos + cuotas + pagos
  const hermanoVisto = new Set<number>();
  let pagoN = 0;
  for (const [idx, [nombre, apellido, cursoN, padreN]] of ALUMNOS.entries()) {
    const curso = CURSOS.find((c) => c.n === cursoN)!;
    const id = `${P}alumno-${idx + 1}`;
    const hermano = hermanoVisto.has(padreN);
    hermanoVisto.add(padreN);
    const nuevo = NUEVOS.has(idx);
    const fechaInsc = nuevo ? utc(2026, 9, 7 + idx) : utc(2026, 3, 2 + (idx % 5));
    const nac = curso.nivel === "kids" ? 2016 - (idx % 3) : curso.nivel.startsWith("teens") ? 2011 - (idx % 3) : 2007 - (idx % 4);
    await prisma.alumno.create({
      data: {
        id, nombre, apellido, dni: `900000${String(idx + 1).padStart(2, "0")}`, fechaNacimiento: utc(nac, 1 + (idx % 12), 3 + idx),
        direccion: `Av. Illia ${200 + idx * 11}, San Luis`, telefono: idx % 3 === 0 ? `2664-77${String(idx).padStart(4, "0")}` : undefined,
        email: idx % 4 === 0 ? `${nombre.toLowerCase().replace(/[^a-z]/g, "")}@prueba.test` : undefined,
        observacionesMedicas: idx === 2 ? "Alergia a la penicilina" : idx === 9 ? "Asma leve" : undefined,
        fechaInscripcion: fechaInsc, estado: "activo", padreId: `${P}padre-${padreN}`, cursoId: `${P}curso-${cursoN}`, aplicaDescuentoHermanos: hermano,
      },
    });
    await prisma.inscripcion.create({ data: { id: `${P}insc-${idx + 1}`, alumnoId: id, cursoId: `${P}curso-${cursoN}`, cicloId: ciclo.id, fecha: fechaInsc, aplicaDescuentoHermanos: hermano } });

    // Documentación: mezcla de estados
    const docs: [("formulario_inscripcion" | "copia_dni" | "autorizacion_imagen"), number][] = [["formulario_inscripcion", 0], ["copia_dni", 1], ["autorizacion_imagen", 2]];
    for (const [tipo, k] of docs) {
      const r = (idx + k) % 5;
      if (tipo !== "autorizacion_imagen") {
        const cargado = r !== 0;
        await prisma.documento.create({ data: { id: `${P}doc-${idx + 1}-${k}`, alumnoId: id, tipo, estado: cargado ? "cargado" : "pendiente", fechaCarga: cargado ? fechaInsc : undefined } });
      } else if (r === 4) {
        await prisma.documento.create({ data: { id: `${P}doc-${idx + 1}-${k}`, alumnoId: id, tipo, estado: "pendiente" } });
      } else if (r === 3) {
        await prisma.documento.create({ data: { id: `${P}doc-${idx + 1}-${k}`, alumnoId: id, tipo, estado: "revocado", autorizadoPor: admin.id, fechaAutorizacion: utc(2026, 4, 12), tipoAutorizacion: "manual" } });
      } else {
        const manual = r === 1;
        await prisma.documento.create({ data: { id: `${P}doc-${idx + 1}-${k}`, alumnoId: id, tipo, estado: "autorizado", autorizadoPor: manual ? admin.id : `${P}padre-${padreN}`, fechaAutorizacion: utc(2026, 3, 5 + (idx % 10)), tipoAutorizacion: manual ? "manual" : "digital" } });
      }
    }

    // Cuotas marzo..septiembre (los nuevos, solo septiembre)
    for (let mes = nuevo ? 9 : 3; mes <= 9; mes++) {
      const descuento = hermano ? Math.round(curso.base * 0.1) : 0;
      const montoFinal = curso.base - descuento;
      let estado: EstadoCuota = "pagada";
      if (mes === 9 && (MOROSOS_2.has(idx) || MOROSOS_1.has(idx) || azar() < 0.35)) estado = "vencida";
      if (mes === 8 && MOROSOS_2.has(idx)) estado = "vencida";
      const venc = utc(2026, mes, 10);
      const cuotaId = `${P}cuota-${idx + 1}-${mes}`;
      await prisma.cuota.create({ data: { id: cuotaId, alumnoId: id, mes, anio: 2026, montoBase: curso.base, descuento, montoFinal, vencimiento: venc, estado } });
      if (estado === "pagada") {
        pagoN++;
        const hoy = mes === 9 && azar() < 0.2;
        const fecha = hoy ? new Date(Date.UTC(2026, 8, 23, 14, 30)) : new Date(Date.UTC(2026, mes - 1, 2 + Math.floor(azar() * 14), 13 + Math.floor(azar() * 5), 10));
        const metodo: MetodoPago = elegir(["efectivo", "transferencia", "tarjeta"]);
        await prisma.pago.create({ data: { id: `${P}pago-${pagoN}`, cuotaId, fechaPago: fecha, metodo, monto: montoFinal, registradoPor: secretario.id } });
      }
    }
  }

  // Asistencia: cada clase entre el 3/8 y hoy
  let asisN = 0;
  for (const c of CURSOS) {
    const alumnosDelCurso = ALUMNOS.map((a, i) => ({ a, i })).filter(({ a }) => a.at(2) === c.n && !NUEVOS.has(ALUMNOS.indexOf(a)));
    for (let dia = new Date(Date.UTC(2026, 7, 3)); dia <= HOY; dia = new Date(dia.getTime() + 86400000)) {
      const dow = dia.getUTCDay() === 0 ? 7 : dia.getUTCDay();
      if (!c.horarios.some((h) => DIAS[h.d] === dow)) continue;
      for (const { i } of alumnosDelCurso) {
        const r = azar();
        // El alumno 4 (índice 3) falta las 3 últimas clases: "ausencias consecutivas".
        const rachaAusente = i === 3 && dia >= utc(2026, 9, 14);
        let estado: "presente" | "tarde" | "ausente" = r < 0.78 ? "presente" : r < 0.9 ? "tarde" : "ausente";
        if (rachaAusente) estado = "ausente";
        asisN++;
        await prisma.asistencia.create({
          data: {
            id: `${P}asis-${asisN}`, alumnoId: `${P}alumno-${i + 1}`, cursoId: `${P}curso-${c.n}`, fecha: dia, estado,
            minutosRetraso: estado === "tarde" ? 5 + Math.floor(azar() * 20) : undefined,
            motivo: estado === "ausente" && azar() < 0.5 ? elegir(["Aviso de la familia", "Enfermedad", "Viaje"]) : undefined,
          },
        });
      }
    }
  }

  // Evaluaciones + calificaciones + notas de cierre
  let evN = 0, calN = 0, ncN = 0;
  for (const c of CURSOS) {
    const alumnos = ALUMNOS.map((a, i) => ({ a, i })).filter(({ a }) => a[2] === c.n && !NUEVOS.has(ALUMNOS.indexOf(a)));
    const conceptual = c.n === 1;
    const evals = [
      { nombre: "Reading Comprehension", tipo: "examen" as const, fecha: utc(2026, 6, 16), periodo: "julio" as const, estado: "publicada" as const },
      { nombre: "Oral Presentation", tipo: "oral" as const, fecha: utc(2026, 7, 2), periodo: "julio" as const, estado: "publicada" as const },
      { nombre: "Grammar Midterm", tipo: "examen" as const, fecha: utc(2026, 9, 29 + (c.n % 2)), periodo: "noviembre" as const, estado: "borrador" as const },
    ];
    for (const e of evals) {
      evN++;
      const eid = `${P}eval-${evN}`;
      await prisma.evaluacion.create({ data: { id: eid, cursoId: `${P}curso-${c.n}`, nombre: e.nombre, tipo: e.tipo, fecha: e.fecha, periodo: e.periodo, escala: conceptual ? "conceptual" : "numerica", estado: e.estado } });
      if (e.estado === "borrador" && e.nombre === "Grammar Midterm" && c.n % 2 === 0) continue; // sin notas todavía
      for (const { i } of alumnos) {
        calN++;
        const nota = conceptual ? elegir(["MB", "B", "B", "R"]) : String(elegir([5, 6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10]));
        await prisma.calificacion.create({ data: { id: `${P}cal-${calN}`, evaluacionId: eid, alumnoId: `${P}alumno-${i + 1}`, nota, observacion: azar() < 0.3 ? elegir(["¡Excelente trabajo!", "Debe repasar vocabulario.", "Muy participativo/a."]) : undefined } });
      }
    }
    for (const { i } of alumnos) {
      ncN++;
      await prisma.notaCierre.create({ data: { id: `${P}nc-${ncN}`, alumnoId: `${P}alumno-${i + 1}`, cursoId: `${P}curso-${c.n}`, periodo: "julio", nota: conceptual ? elegir(["MB", "B"]) : String(elegir([6, 7, 8, 9])), estado: c.n <= 3 ? "publicada" : "borrador", observacion: azar() < 0.3 ? "Buen desempeño en el período." : undefined } });
    }
  }

  // Observaciones (incluye una categoría personalizada)
  await prisma.categoriaPersonalizada.create({ data: { id: `${P}cat-1`, cursoId: `${P}curso-2`, profesorId: martinProf.id, nombre: "Puntualidad" } });
  const obs: [number, string, Rol, string, string][] = [
    [1, "academico", "profesor", martinUser.id, "Muestra muy buen progreso en lectura; se recomienda seguir practicando en casa."],
    [2, "felicitacion", "profesor", martinUser.id, "Excelente participación en clase esta semana."],
    [3, "comportamiento", "profesor", martinUser.id, "Conversa durante las explicaciones; trabajamos en sostener la atención."],
    [5, `${P}cat-1`, "profesor", martinUser.id, "Llegó tarde tres veces este mes."],
    [6, "academico", "profesor", martinUser.id, "Debe reforzar el uso de los tiempos verbales."],
    [4, "administrativo", "secretario", secretario.id, "Recordatorio: falta completar la documentación del legajo."],
    [12, "administrativo", "secretario", secretario.id, "Cuota de septiembre pendiente de pago."],
    [12, "felicitacion", "admin", admin.id, "Felicitaciones por el resultado del examen."],
    [16, "academico", "profesor", martinUser.id, "Necesita apoyo adicional en Listening."],
    [8, "comportamiento", "profesor", martinUser.id, "Colabora muy bien con sus compañeros."],
  ];
  for (const [k, [n, categoria, rol, emisor, texto]] of obs.entries()) {
    await prisma.observacion.create({ data: { id: `${P}obs-${k + 1}`, alumnoId: `${P}alumno-${n}`, emisorId: emisor, emisorRol: rol, fecha: utc(2026, 9, 1 + k), texto, categoria } });
  }

  // Chats: 4 familias con conversación
  const charlas: [number, [Rol, string, string][]][] = [
    [1, [["padre", "p1", "Hola, quería consultar si puedo abonar las dos cuotas juntas este mes."], ["secretario", "sec", "¡Hola Carlos! Sí, podés abonar ambas juntas en secretaría, ya tenés el 10% de descuento aplicado."], ["padre", "p1", "Perfecto, muchas gracias. Paso el viernes."], ["secretario", "sec", "Te esperamos. Cualquier consulta estamos a disposición."]]],
    [2, [["padre", "p2", "Buenas tardes, Julieta no va a poder asistir el jueves por un turno médico."], ["secretario", "sec", "Gracias por avisar, queda registrado."]]],
    [3, [["padre", "p3", "¿Cuándo son las notas del primer cierre?"]]],
    [4, [["padre", "p4", "Hola, ¿tienen alguna fecha para la reunión de padres?"], ["admin", "adm", "Hola Gustavo, será el 3 de octubre a las 19 hs. Les llegará el aviso."], ["padre", "p4", "Excelente, gracias."]]],
  ];
  let msgN = 0;
  for (const [n, msgs] of charlas) {
    await prisma.chat.create({ data: { id: `${P}chat-${n}`, padreId: `${P}padre-${n}`, creadoEn: utc(2026, 9, 10) } });
    for (const [k, [rol, quien, texto]] of msgs.entries()) {
      msgN++;
      await prisma.mensaje.create({
        data: {
          id: `${P}msg-${msgN}`, chatId: `${P}chat-${n}`, rolEmisor: rol, texto,
          emisorId: quien === "sec" ? secretario.id : quien === "adm" ? admin.id : `${P}usuario-${n}`,
          fecha: new Date(Date.UTC(2026, 8, 14 + n, 13 + k, 5 * k)),
        },
      });
    }
  }

  const c = async (t: () => Promise<number>) => t();
  console.log("Datos de prueba creados:", {
    alumnos: await c(() => prisma.alumno.count({ where: { id: { startsWith: P } } })),
    cuotas: await c(() => prisma.cuota.count({ where: { id: { startsWith: P } } })),
    pagos: await c(() => prisma.pago.count({ where: { id: { startsWith: P } } })),
    asistencias: await c(() => prisma.asistencia.count({ where: { id: { startsWith: P } } })),
    calificaciones: await c(() => prisma.calificacion.count({ where: { id: { startsWith: P } } })),
    mensajes: await c(() => prisma.mensaje.count({ where: { id: { startsWith: P } } })),
  });
}

const modo = process.argv[2];
(modo === "borrar" ? borrar().then(() => console.log("Datos de prueba borrados")) : modo === "crear" ? crear() : Promise.reject(new Error("Uso: crear | borrar")))
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
