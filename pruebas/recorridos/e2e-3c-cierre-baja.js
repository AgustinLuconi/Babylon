// Una baja en un curso con todas las notas de cierre publicadas no las vuelve borrador; una nota tipeada para un
// alumno que se fue no deja la pantalla "sin guardar". Antes: _mundo-avisos.ts crear.
const { chromium } = require("playwright");
const ok = (e, r, x) => console.log(`${e}: ${r} (esperado ${x})`);
const BASE = "http://localhost:5173";
const API = "http://localhost:4000";
const P = "prueba-tmp-av";
const email = (x) => `${P}-${x}@prueba.babylon.test`;
async function entrar(p, quien) {
  await p.goto(`${BASE}/login`);
  await p.fill('input[name="email"]', email(quien));
  await p.fill('input[name="password"]', "prueba1234");
  await p.click('button[type="submit"]');
  await p.waitForURL((u) => !u.pathname.startsWith("/login"));
}
async function loginApi(quien) {
  const r = await fetch(`${API}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: email(quien), password: "prueba1234" }) });
  return (await r.json()).token;
}
const pedir = async (metodo, ruta, token, cuerpo) => {
  const r = await fetch(`${API}${ruta}`, { method: metodo, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: cuerpo ? JSON.stringify(cuerpo) : undefined });
  const t = await r.text();
  return t ? JSON.parse(t) : null;
};
(async () => {
  const [profeTk, secreTk] = [await loginApi("profe"), await loginApi("secre")];
  const notas = await pedir("POST", "/api/calificaciones/notas-cierre", profeTk, { notas: ["hijo1", "hijo2"].map((h) => ({ alumnoId: `${P}-${h}`, cursoId: `${P}-curso`, periodo: "noviembre", nota: "8" })) });
  await pedir("POST", "/api/calificaciones/notas-cierre/publicar", profeTk, { ids: notas.map((n) => n.id) });
  const b = await chromium.launch({ executablePath: "/usr/bin/google-chrome" });
  const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
  await entrar(p, "profe");
  await p.goto(`${BASE}/calificaciones?curso=${P}-curso&vista=cierre&periodo=noviembre`);
  const nota1 = p.locator(`[data-alumno="${P}-hijo1"] input`).first();
  await nota1.waitFor();
  ok("todas publicadas: no se pueden editar", await nota1.isDisabled(), true);
  await pedir("PATCH", `/api/alumnos/${P}-hijo2`, secreTk, { estado: "inactivo" });
  await p.waitForTimeout(2500);
  ok("después de una baja siguen publicadas (no vuelven a borrador)", await nota1.isDisabled(), true);

  await pedir("PATCH", `/api/alumnos/${P}-hijo2`, secreTk, { estado: "activo" });
  const ev = await pedir("POST", "/api/calificaciones/evaluaciones", profeTk, { cursoId: `${P}-curso`, nombre: "Reading", tipo: "examen", fecha: "2026-10-21", periodo: "noviembre" });
  await p.goto(`${BASE}/calificaciones?curso=${P}-curso&evaluacion=${ev.id}`);
  const nota2 = p.locator(`[data-alumno="${P}-hijo2"] input[type="number"]`);
  await nota2.waitFor();
  await nota2.fill("7");
  await pedir("PATCH", `/api/alumnos/${P}-hijo2`, secreTk, { estado: "inactivo" });
  await p.waitForTimeout(2500);
  await p.click("nav a:has-text('Asistencia')");
  await p.waitForTimeout(800);
  ok("la nota de un alumno que se fue no deja la pantalla sin guardar", await p.locator("text=Tenés cambios sin guardar. ¿Salir igual?").count(), 0);
  ok("y se puede salir sin preguntar", new URL(p.url()).pathname, "/asistencia");
  await b.close();
})();
