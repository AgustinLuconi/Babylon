// Las clases sin dictar por HTTP: la familia recibe la lista sin el motivo (en la respuesta cruda del servidor), solo de su hijo.
// Requiere la API levantada.
import { PrismaClient } from "@prisma/client";
import { ok } from "./_check";
import { CLAVE, crearMundo, email, limpiarMundo, P } from "./_mundo-avisos";

const API = "http://localhost:4000";
const prisma = new PrismaClient();
const MOTIVO = "Motivo-secreto-xyz";

async function login(quien: string): Promise<string> {
  const r = await fetch(`${API}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: email(quien), password: CLAVE }) });
  return ((await r.json()) as { token: string }).token;
}
async function pedir(ruta: string, token: string): Promise<{ status: number; texto: string }> {
  const r = await fetch(`${API}${ruta}`, { headers: { Authorization: `Bearer ${token}` } });
  return { status: r.status, texto: await r.text() };
}

(async () => {
  const m = await crearMundo(prisma);
  try {
    await prisma.claseSinDictar.create({ data: { id: `${P}-sc-http`, cursoId: m.cursoId, fecha: new Date("2026-05-05T00:00:00Z"), motivo: MOTIVO, registradaPor: m.profe } });
    const [padre, secre, profe] = [await login("padre"), await login("secre"), await login("profe")];

    const familia = await pedir(`/api/asistencia/alumnos/${m.hijo1}/sin-clases`, padre);
    ok("la familia lee las marcas de su hijo", `${familia.status} ${familia.texto.includes("2026-05-05")}`, "200 true");
    ok("la respuesta cruda a la familia no contiene el motivo ni la clave", `${familia.texto.includes(MOTIVO)} ${familia.texto.includes("motivo")}`, "false false");
    ok("la familia no ve a un alumno ajeno", (await pedir(`/api/asistencia/alumnos/${m.alumnoAjeno}/sin-clases`, padre)).status, 403);
    ok("la familia no usa la lista de un curso", (await pedir(`/api/asistencia/cursos/${m.cursoId}/sin-clases`, padre)).status, 403);

    const equipo = await pedir(`/api/asistencia/alumnos/${m.hijo1}/sin-clases`, secre);
    ok("secretaría sí recibe el motivo", `${equipo.status} ${equipo.texto.includes(MOTIVO)}`, "200 true");
    const delCurso = await pedir(`/api/asistencia/cursos/${m.cursoId}/sin-clases`, profe);
    ok("el profesor del curso lee la lista del curso con el motivo", `${delCurso.status} ${delCurso.texto.includes(MOTIVO)}`, "200 true");
    ok("el profesor del curso lee la lista de un curso ajeno: 403", (await pedir(`/api/asistencia/cursos/${m.cursoMultiId}/sin-clases`, profe)).status, 403);
  } catch (e) {
    ok("sin excepciones", String(e), "ninguna");
  } finally {
    await limpiarMundo(prisma);
    await prisma.$disconnect();
    process.exit(0);
  }
})();
