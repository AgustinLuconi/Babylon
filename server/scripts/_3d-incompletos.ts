// 3d, Tarea 6: datos incompletos (endpoint, criterio del aviso y aviso de la campana). Requiere la API levantada en :4000
// (mundo prueba-tmp-av). Los alumnos reales del ciclo activo también cuentan: los totales se comparan contra el endpoint.
import { PrismaClient } from "@prisma/client";
import { ok } from "./_check";
import { CLAVE, crearMundo, email, limpiarMundo, P } from "./_mundo-avisos";
import type { AlumnoRepository } from "../src/modules/alumnos/alumno.repository";
import { PrismaDocumentoRepository } from "../src/modules/documentos/documento.repository.prisma";
import { PrismaCriteriosDeAvisos } from "../src/modules/notificaciones/notificacion.criterios.prisma";

const API = "http://localhost:4000";
const prisma = new PrismaClient();

async function login(quien: string): Promise<string> {
  const r = await fetch(`${API}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: email(quien), password: CLAVE }),
  });
  return ((await r.json()) as { token: string }).token;
}
async function pedir<T = unknown>(metodo: string, ruta: string, token: string, cuerpo?: unknown): Promise<{ status: number; d: T }> {
  const r = await fetch(`${API}${ruta}`, {
    method: metodo,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
  });
  const texto = await r.text();
  return { status: r.status, d: (texto ? JSON.parse(texto) : null) as T };
}
interface Aviso {
  id: string;
  tipo: string;
  texto: string;
  leida: boolean;
  resuelta: boolean;
  recurso: { tipo: string };
}
const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const m = await crearMundo(prisma);
  const [admin, secre, profe, padre] = await Promise.all(["admin", "secre", "profe", "padre"].map(login));
  const incompletos = async () => (await pedir<Record<string, string[]>>("GET", "/api/alumnos/incompletos", secre)).d;
  const avisoDe = async (token: string) => (await pedir<{ avisos: Aviso[] }>("GET", "/api/notificaciones", token)).d.avisos.find((a) => a.tipo === "datos_incompletos");
  const textoDe = (n: number) => `Hay ${n} ${n === 1 ? "alumno" : "alumnos"} con datos incompletos`;

  // ── Endpoint ──
  let lista = await incompletos();
  ok("incompletos: un alumno sin vínculo ni datos del responsable", lista[m.hijo1]?.join(","), "vinculo,responsableTelefono,responsableEmail");
  ok("incompletos: los profesores y las familias no lo ven", `${(await pedir("GET", "/api/alumnos/incompletos", profe)).status} ${(await pedir("GET", "/api/alumnos/incompletos", padre)).status}`, "403 403");
  await prisma.alumno.update({ where: { id: m.hijo2 }, data: { estado: "inactivo" } });
  ok("incompletos: un alumno inactivo no figura", m.hijo2 in (await incompletos()), false);
  await prisma.alumno.update({ where: { id: m.hijo2 }, data: { estado: "activo" } });
  const otroCiclo = await prisma.ciclo.findFirst({ where: { activo: false } });
  if (otroCiclo) {
    await prisma.inscripcion.update({ where: { id: `${m.hijo2}-insc` }, data: { cicloId: otroCiclo.id } });
    ok("incompletos: inscripto solo en otro ciclo no figura", m.hijo2 in (await incompletos()), false);
    await prisma.inscripcion.update({ where: { id: `${m.hijo2}-insc` }, data: { cicloId: m.cicloId } });
  }
  await pedir("PUT", `/api/alumnos/${m.hijo1}/responsable`, secre, { tipo: "existente", padreId: m.padreId, vinculo: "madre" });
  ok("incompletos: con vínculo ya no falta el vínculo", (await incompletos())[m.hijo1]?.join(","), "responsableTelefono,responsableEmail");
  await pedir("PATCH", `/api/padres/${m.padreId}`, secre, { telefono: "351 555-1234", email: email("mamaav") });
  ok("incompletos: completar los datos del responsable saca al alumno", m.hijo1 in (await incompletos()), false);
  lista = await incompletos();
  ok("incompletos: el hermano sigue (le falta el vínculo)", lista[m.hijo2]?.join(","), "vinculo");

  // ── Aviso de la campana ──
  await pedir("PATCH", `/api/alumnos/${m.hijo1}`, secre, { dni: null });
  let n = Object.keys(await incompletos()).length;
  const delAdmin = await avisoDe(admin);
  const delSecre = await avisoDe(secre);
  ok("aviso: lo reciben administración y secretaría con la cantidad", `${delAdmin?.texto} | ${delSecre?.texto}`, `${textoDe(n)} | ${textoDe(n)}`);
  ok("aviso: lleva a la lista de datos incompletos", delSecre?.recurso.tipo, "datos-incompletos");
  ok("aviso: no le llega a las familias ni a los profesores", `${await avisoDe(padre)} ${await avisoDe(profe)}`, "undefined undefined");
  await pedir("POST", `/api/notificaciones/${delSecre!.id}/leida`, secre);
  ok("aviso: leído", (await avisoDe(secre))?.leida, true);
  await pedir("PATCH", `/api/alumnos/${m.hijo1}`, secre, { dni: "99400011" });
  n = Object.keys(await incompletos()).length;
  const bajo = await avisoDe(secre);
  ok("aviso: si baja la cantidad se actualiza el número y sigue leído", `${bajo?.texto} ${bajo?.leida}`, `${textoDe(n)} true`);
  await pedir("PATCH", `/api/alumnos/${m.hijo1}`, secre, { dni: null });
  n = Object.keys(await incompletos()).length;
  const crecio = await avisoDe(secre);
  ok("aviso: si vuelve a crecer la cantidad vuelve a no leído, con el número nuevo", `${crecio?.texto} ${crecio?.leida}`, `${textoDe(n)} false`);
  await pedir("PATCH", `/api/notificaciones/preferencias/datos_incompletos`, secre, { activa: false });
  ok("aviso: apagado en las preferencias desaparece", await avisoDe(secre), undefined);
  await pedir("PATCH", `/api/notificaciones/preferencias/datos_incompletos`, secre, { activa: true });
  ok("aviso: encendido vuelve", (await avisoDe(secre))?.tipo, "datos_incompletos");

  // ── Criterio del aviso con una lista controlada (no depende de alumnos reales) ──
  const criterio = (cantidad: number) =>
    new PrismaCriteriosDeAvisos(prisma, new PrismaDocumentoRepository(prisma), {
      findIncompletos: async () => Array.from({ length: cantidad }, (_, i) => ({ alumnoId: `${P}-x${i}`, nombre: "x", faltan: ["dni" as const] })),
    } as unknown as AlumnoRepository);
  const ahora = new Date();
  ok("criterio: sin incompletos no hay aviso", (await criterio(0).esperados("datos_incompletos", ahora)).length, 0);
  const uno = (await criterio(1).esperados("datos_incompletos", ahora))[0];
  ok("criterio: un alumno, en singular", uno?.texto, "Hay 1 alumno con datos incompletos");
  const tres = (await criterio(3).esperados("datos_incompletos", ahora))[0];
  ok("criterio: tres alumnos", `${tres?.texto} nivel ${tres?.nivel} clave ${tres?.clave}`, "Hay 3 alumnos con datos incompletos nivel 3 clave datos-incompletos");

  await esperar(100);
  await limpiarMundo(prisma);
  await prisma.$disconnect();
})();
