// Barrido de la API: con un ciclo bloqueado, toda ruta de escritura que toca algo del ciclo lo rechaza (409, o 400 cuando
// el curso ni siquiera es del ciclo activo); con el ciclo abierto las mismas rutas funcionan; y cada ruta de escritura
// de los módulos con datos de ciclo está clasificada (una ruta nueva sin clasificar hace fallar la batería).
// Requiere la API levantada en :4000 (mundo prueba-tmp-av).
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";
import { hoyISOEnArgentina } from "../src/core/fechas";
import { ok } from "./_check";
import { CLAVE, crearMundo, email, limpiarMundo, P, type Mundo } from "./_mundo-avisos";

const API = "http://localhost:4000";
const prisma = new PrismaClient();

type Rol = "admin" | "secre" | "profe";
const tokens = {} as Record<Rol, string>;
async function login(quien: Rol): Promise<string> {
  const r = await fetch(`${API}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: email(quien), password: CLAVE }) });
  return ((await r.json()) as { token: string }).token;
}
async function pedir(metodo: string, ruta: string, rol: Rol, cuerpo?: unknown): Promise<{ status: number; texto: string; d: any }> {
  const r = await fetch(`${API}${ruta}`, {
    method: metodo,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokens[rol]}` },
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
  });
  const texto = await r.text();
  return { status: r.status, texto, d: texto ? JSON.parse(texto) : null };
}

interface Contexto {
  m: Mundo;
  ciclo: string;
  curso: string;
  alumno: string;
  evaluacionId: string;
  notaCierreId: string;
  pausaId: string;
}
interface Escritura {
  plantilla: string; // "METODO /api/ruta/:id", igual que en los archivos *.routes.ts
  rol: Rol;
  ruta: (c: Contexto) => string;
  cuerpo: (c: Contexto) => unknown;
  bloqueado: number[]; // estados esperados con el ciclo bloqueado
  desbloqueado: number[]; // y con el ciclo abierto
}
// "Hoy" en hora de Argentina (con toISOString pasadas las 21:00 sería mañana, y la asistencia no puede ser futura).
const hoy = hoyISOEnArgentina();
// Ayer (para marcar una clase sin dictar sin chocar con la asistencia de "hoy" de otra entrada).
const ayer = new Date(Date.parse(`${hoy}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10);
const RECHAZADAS: Escritura[] = [
  { plantilla: "POST /api/ciclos/:id/pausas", rol: "admin", ruta: (c) => `/api/ciclos/${c.ciclo}/pausas`, cuerpo: () => ({ desde: "2099-07-20", hasta: "2099-07-31", nombre: "Pruebaav receso", tipo: "receso" }), bloqueado: [409], desbloqueado: [201] },
  { plantilla: "PATCH /api/ciclos/:id/pausas/:pausaId", rol: "admin", ruta: (c) => `/api/ciclos/${c.ciclo}/pausas/${c.pausaId}`, cuerpo: () => ({ nombre: "Pruebaav otra" }), bloqueado: [409], desbloqueado: [200] },
  { plantilla: "DELETE /api/ciclos/:id/pausas/:pausaId", rol: "admin", ruta: (c) => `/api/ciclos/${c.ciclo}/pausas/${c.pausaId}`, cuerpo: () => undefined, bloqueado: [409], desbloqueado: [204] },
  { plantilla: "POST /api/cursos", rol: "admin", ruta: () => "/api/cursos", cuerpo: (c) => ({ nombre: "Pruebaav Nuevo", nivel: "kids", profesorId: c.m.profesorId, cicloId: c.ciclo, cupo: 10 }), bloqueado: [409], desbloqueado: [201] },
  { plantilla: "PATCH /api/cursos/:id", rol: "admin", ruta: (c) => `/api/cursos/${c.curso}`, cuerpo: () => ({ cupo: 11 }), bloqueado: [409], desbloqueado: [200] },
  { plantilla: "POST /api/asistencia/masiva", rol: "profe", ruta: () => "/api/asistencia/masiva", cuerpo: (c) => ({ cursoId: c.curso, fecha: hoy, registros: [{ alumnoId: c.alumno, estado: "presente" }] }), bloqueado: [409], desbloqueado: [201, 200] },
  { plantilla: "POST /api/calificaciones/evaluaciones", rol: "profe", ruta: () => "/api/calificaciones/evaluaciones", cuerpo: (c) => ({ cursoId: c.curso, nombre: "Pruebaav otra", tipo: "examen", fecha: hoy, periodo: "julio" }), bloqueado: [409], desbloqueado: [201] },
  { plantilla: "PATCH /api/calificaciones/evaluaciones/:id/publicar", rol: "profe", ruta: (c) => `/api/calificaciones/evaluaciones/${c.evaluacionId}/publicar`, cuerpo: () => undefined, bloqueado: [409], desbloqueado: [200] },
  { plantilla: "POST /api/calificaciones/evaluaciones/:id/calificaciones", rol: "profe", ruta: (c) => `/api/calificaciones/evaluaciones/${c.evaluacionId}/calificaciones`, cuerpo: (c) => ({ notas: [{ alumnoId: c.alumno, nota: "8" }] }), bloqueado: [409], desbloqueado: [201, 200] },
  { plantilla: "POST /api/calificaciones/notas-cierre", rol: "profe", ruta: () => "/api/calificaciones/notas-cierre", cuerpo: (c) => ({ notas: [{ alumnoId: c.alumno, cursoId: c.curso, periodo: "julio", nota: "7" }] }), bloqueado: [409], desbloqueado: [201, 200] },
  { plantilla: "POST /api/calificaciones/notas-cierre/publicar", rol: "profe", ruta: () => "/api/calificaciones/notas-cierre/publicar", cuerpo: (c) => ({ ids: [c.notaCierreId] }), bloqueado: [409], desbloqueado: [200] },
  { plantilla: "POST /api/observaciones/categorias", rol: "profe", ruta: () => "/api/observaciones/categorias", cuerpo: (c) => ({ cursoId: c.curso, nombre: "Pruebaav categoría" }), bloqueado: [409], desbloqueado: [201] },
  // El curso de 2099 no es del ciclo activo: se rechaza por eso (400) o por el bloqueo (409), nunca se acepta.
  { plantilla: "POST /api/alumnos", rol: "secre", ruta: () => "/api/alumnos", cuerpo: (c) => ({ nombre: "Pruebaavnuevo", apellido: "Pruebaav", cursoId: c.curso, responsable: { tipo: "existente", padreId: c.m.padreId, vinculo: "padre" } }), bloqueado: [400, 409], desbloqueado: [400] },
  { plantilla: "PATCH /api/alumnos/:id", rol: "secre", ruta: (c) => `/api/alumnos/${c.m.hijo1}`, cuerpo: (c) => ({ cursoId: c.curso }), bloqueado: [400, 409], desbloqueado: [400] },
  { plantilla: "POST /api/asistencia/sin-clases", rol: "profe", ruta: () => "/api/asistencia/sin-clases", cuerpo: (c) => ({ cursoId: c.curso, fecha: ayer }), bloqueado: [409], desbloqueado: [201] },
  { plantilla: "DELETE /api/asistencia/sin-clases/:cursoId/:fecha", rol: "profe", ruta: (c) => `/api/asistencia/sin-clases/${c.curso}/${ayer}`, cuerpo: () => undefined, bloqueado: [409], desbloqueado: [204] },
  // Va al final: cambia las fechas del ciclo y la asistencia de "hoy" de más arriba dejaría de caer dentro del calendario.
  { plantilla: "PATCH /api/ciclos/:id/fechas", rol: "admin", ruta: (c) => `/api/ciclos/${c.ciclo}/fechas`, cuerpo: () => ({ inicio: "2099-03-01", fin: "2099-11-30" }), bloqueado: [409], desbloqueado: [200] },
];
// Rutas de módulos con datos de ciclo que se pueden usar con el ciclo bloqueado (son datos de la persona o cobros).
const EXENTAS = [
  "PUT /api/alumnos/:id/responsable",
  "POST /api/observaciones",
  "POST /api/cuotas/pagos",
  // El módulo de ciclos es el dueño de las inscripciones: sus rutas se clasifican una por una (una ruta nueva que escriba
  // inscripciones tendría que pasar por la guarda y figurar en RECHAZADAS).
  "POST /api/ciclos",
  "PATCH /api/ciclos/:id/activar",
  "PATCH /api/ciclos/:id/bloquear",
  "PATCH /api/ciclos/:id/desbloquear",
  "POST /api/ciclos/pase-de-anio/vista-previa",
  "POST /api/ciclos/pase-de-anio/confirmar",
];
// Módulos enteros sin datos que pertenezcan a un ciclo.
const MODULOS_SIN_CICLO = ["/api/auth", "/api/padres", "/api/profesores", "/api/documentos", "/api/chats", "/api/notificaciones", "/api/configuracion", "/api/automatizaciones"];

// Routers montados que solo tienen lecturas (el canal en vivo, SSE).
const SIN_ESCRITURAS = new Set(["tiempoReal"]);

// Todas las rutas de escritura declaradas en los *.routes.ts, con el prefijo con que las monta server.ts.
function rutasDeEscritura(): string[] {
  const raiz = join(__dirname, "..", "src");
  const server = readFileSync(join(raiz, "server.ts"), "utf8");
  const montajes = [...server.matchAll(/app\.use\("(\/api\/[a-z-]+)",\s*(\w+)Routes\(/g)].map((x) => ({ prefijo: x[1], nombre: x[2] }));
  const importes = Object.fromEntries([...server.matchAll(/import \{ (\w+)Routes \} from "\.\/modules\/([^"]+)"/g)].map((x) => [x[1], x[2]]));
  const salida: string[] = [];
  // Si algo no se reconoce, la prueba falla: nunca da verde sin haber mirado.
  const totalMontajes = [...server.matchAll(/app\.use\(\s*["'`]\/api\//g)].length;
  if (totalMontajes !== montajes.length) throw new Error(`server.ts monta ${totalMontajes} rutas pero se reconocieron ${montajes.length}`);
  for (const { prefijo, nombre } of montajes) {
    const archivo = importes[nombre];
    if (!archivo) {
      if (SIN_ESCRITURAS.has(nombre)) continue;
      throw new Error(`router montado de una forma no reconocida: ${nombre} (${prefijo})`);
    }
    const texto = readFileSync(join(raiz, "modules", `${archivo}.ts`), "utf8");
    const leidas = [...texto.matchAll(/router\.(post|put|patch|delete)\(\s*"([^"]*)"/g)];
    const declaradas = [...texto.matchAll(/router\.(post|put|patch|delete)\b/g)].length;
    if (/router\.route\(/.test(texto) || declaradas !== leidas.length) {
      throw new Error(`${archivo}: hay rutas de escritura declaradas de una forma que la prueba no sabe leer (${declaradas} contra ${leidas.length} leídas)`);
    }
    for (const x of leidas) salida.push(`${x[1].toUpperCase()} ${prefijo}${x[2] === "/" ? "" : x[2]}`);
  }
  return salida;
}

(async () => {
  const m = await crearMundo(prisma);
  try {
    for (const rol of ["admin", "secre", "profe"] as Rol[]) tokens[rol] = await login(rol);
    const ciclo = `${P}-ciclo-2099`;
    await prisma.ciclo.create({ data: { id: ciclo, anio: 2099, activo: false, inicio: new Date("2000-01-01T00:00:00Z"), fin: new Date("2099-12-31T00:00:00Z") } }); // calendario ancho: "hoy" cae dentro
    const curso = `${P}-curso-2099`;
    await prisma.curso.create({ data: { id: curso, nombre: "Pruebaav 2099", nivel: "kids", profesorId: m.profesorId, cicloId: ciclo, cupo: 10, estado: "activo" } });
    const alumno = `${P}-alu-2099`;
    await prisma.alumno.create({
      data: { id: alumno, nombre: "Pruebaav2099", apellido: "Pruebaav", fechaInscripcion: new Date(), estado: "activo", padreId: m.padreId, cursoId: curso, aplicaDescuentoHermanos: false },
    });
    await prisma.inscripcion.create({ data: { id: `${alumno}-insc`, alumnoId: alumno, cursoId: curso, cicloId: ciclo, fecha: new Date(), aplicaDescuentoHermanos: false } });
    const pausaId = `${P}-pausa-2099`;
    await prisma.pausaDelCiclo.create({ data: { id: pausaId, cicloId: ciclo, desde: new Date("2099-09-01T00:00:00Z"), hasta: new Date("2099-09-02T00:00:00Z"), nombre: "Pruebaav pausa", tipo: "otro" } });
    const base = { m, ciclo, curso, alumno, evaluacionId: "", notaCierreId: "", pausaId };
    // Con el ciclo abierto: una evaluación y una nota de cierre para poder publicarlas después
    const ev = await pedir("POST", "/api/calificaciones/evaluaciones", "profe", { cursoId: curso, nombre: "Pruebaav eval", tipo: "examen", fecha: hoy, periodo: "julio" });
    const nc = await pedir("POST", "/api/calificaciones/notas-cierre", "profe", { notas: [{ alumnoId: alumno, cursoId: curso, periodo: "julio", nota: "6" }] });
    const c: Contexto = { ...base, evaluacionId: ev.d?.id ?? "", notaCierreId: nc.d?.[0]?.id ?? "" };
    ok("preparación: evaluación y nota de cierre creadas", Boolean(c.evaluacionId && c.notaCierreId), true);

    // Parte 1: ciclo bloqueado
    ok("bloquear el ciclo de prueba", (await pedir("PATCH", `/api/ciclos/${ciclo}/bloquear`, "admin")).status, 200);
    for (const e of RECHAZADAS) {
      const r = await pedir(e.plantilla.split(" ")[0], e.ruta(c), e.rol, e.cuerpo(c));
      ok(`bloqueado: ${e.plantilla}`, e.bloqueado.includes(r.status) ? "rechazada" : `${r.status} ${r.texto.slice(0, 80)}`, "rechazada");
    }
    const pdte = await prisma.cuota.create({ data: { id: `${P}-cuota-b`, alumnoId: alumno, mes: 3, anio: 2099, montoBase: 1000, descuento: 0, montoFinal: 1000, vencimiento: new Date("2099-03-10T00:00:00Z"), estado: "pendiente" } });
    ok("bloqueado (exenta): cobrar una cuota", (await pedir("POST", "/api/cuotas/pagos", "admin", { cuotaIds: [pdte.id], metodo: "efectivo" })).status, 201);
    ok("bloqueado (exenta): datos del alumno", (await pedir("PATCH", `/api/alumnos/${alumno}`, "secre", { observacionesMedicas: "Pruebaav" })).status, 200);
    ok("bloqueado (exenta): una observación", (await pedir("POST", "/api/observaciones", "profe", { alumnoId: alumno, categoria: "academico", texto: "Pruebaav" })).status, 201);
    ok("bloqueado: el mensaje dice que el ciclo está bloqueado", (await pedir("PATCH", `/api/cursos/${curso}`, "admin", { cupo: 12 })).texto.includes("bloqueado"), true);

    // Parte 2: ciclo abierto
    ok("desbloquear el ciclo de prueba", (await pedir("PATCH", `/api/ciclos/${ciclo}/desbloquear`, "admin")).status, 200);
    for (const e of RECHAZADAS) {
      const r = await pedir(e.plantilla.split(" ")[0], e.ruta(c), e.rol, e.cuerpo(c));
      ok(`abierto: ${e.plantilla}`, e.desbloqueado.includes(r.status) ? "aceptada" : `${r.status} ${r.texto.slice(0, 80)}`, "aceptada");
    }

    // Parte 3: cobertura. Cada ruta de escritura de un módulo con datos de ciclo está clasificada.
    const conocidas = new Set([...RECHAZADAS.map((e) => e.plantilla), ...EXENTAS]);
    const sinClasificar = rutasDeEscritura().filter((r) => !MODULOS_SIN_CICLO.some((p) => r.split(" ")[1].startsWith(p)) && !conocidas.has(r));
    for (const r of sinClasificar) console.log(`ruta sin clasificar: ${r} (esperado ninguna)`);
    ok("rutas de escritura sin clasificar", sinClasificar.length, 0);
    const rutas = rutasDeEscritura();
    ok("la lectura de rutas ve las del barrido", [...conocidas].every((r) => rutas.includes(r)), true);
  } catch (e) {
    ok("sin excepciones", String(e), "ninguna");
  } finally {
    await limpiarMundo(prisma);
    await prisma.$disconnect();
    process.exit(0);
  }
})();
