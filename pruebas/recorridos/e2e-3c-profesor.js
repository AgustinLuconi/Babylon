// El profesor no pierde lo tipeado si cambia su nómina, entiende qué pasó y se entera si pierde el curso.
// Antes: _mundo-avisos.ts crear.
const { chromium } = require("playwright");
const { execSync } = require("child_process");
const ok = (e, r, x) => console.log(`${e}: ${r} (esperado ${x})`);
const S = require("node:path").join(__dirname, "..", "bin");
const BASE = "http://localhost:5173";
const API = "http://localhost:4000";
const P = "prueba-tmp-av";
const q = (sql) => execSync(`docker exec babylon-postgres psql -U babylon -d babylon -tAc "${sql.replace(/"/g, '\\"')}"`).toString().trim();
const email = (x) => `${P}-${x}@prueba.babylon.test`;
async function entrar(p, quien) {
  await p.goto(`${BASE}/login`);
  await p.fill('input[name="email"]', email(quien));
  await p.fill('input[name="password"]', "prueba1234");
  await p.click('button[type="submit"]');
  await p.waitForURL((u) => !u.pathname.startsWith("/login"));
}
async function loginApi(quien) {
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(`${API}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: email(quien), password: "prueba1234" }) });
      return (await r.json()).token;
    } catch {
      await new Promise((r) => setTimeout(r, 300));
    }
  }
}
const pedir = async (metodo, ruta, token, cuerpo) => {
  const r = await fetch(`${API}${ruta}`, { method: metodo, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: cuerpo ? JSON.stringify(cuerpo) : undefined });
  const t = await r.text();
  return t ? JSON.parse(t) : null;
};
const nota = (p, alumno) => p.locator(`[data-alumno="${P}-${alumno}"] input[type="number"]`);

(async () => {
  const profeTk = await loginApi("profe");
  const ev = await pedir("POST", "/api/calificaciones/evaluaciones", profeTk, { cursoId: `${P}-curso`, nombre: "Listening", tipo: "examen", fecha: "2026-10-20", periodo: "noviembre", escala: "numerica" });
  const navegador = await chromium.launch({ executablePath: "/usr/bin/google-chrome" });
  const profe = await navegador.newPage({ viewport: { width: 1280, height: 900 } });
  await entrar(profe, "profe");
  await profe.goto(`${BASE}/calificaciones?curso=${P}-curso&evaluacion=${ev.id}`);
  await nota(profe, "hijo1").waitFor();
  await nota(profe, "hijo1").fill("8");
  await nota(profe, "hijo2").fill("6");

  // Una actualización de la lista de notas guardadas (al reconectarse) no pisa lo tipeado
  execSync(`bash "${S}/reiniciar-api.sh"`);
  await profe.waitForTimeout(12000);
  ok("lo tipeado sobrevive a que se vuelva a pedir la lista", `${await nota(profe, "hijo1").inputValue()} ${await nota(profe, "hijo2").inputValue()}`, "8 6");

  // La secretaria inscribe un alumno nuevo en el curso y da de baja a Lunaav
  const secreTk = await loginApi("secre");
  const nuevo = await pedir("POST", "/api/alumnos", secreTk, { nombre: "Nuevoav", apellido: "Pruebaav", dni: "99400095", fechaNacimiento: "2015-05-05", padreId: `${P}-padre`, cursoId: `${P}-curso` });
  await pedir("PATCH", `/api/alumnos/${P}-hijo2`, secreTk, { estado: "inactivo" });
  await profe.waitForTimeout(2500);
  ok("la nota de Tomasav sigue tipeada", await nota(profe, "hijo1").inputValue(), "8");
  ok("la fila de Lunaav ya no está", await profe.locator(`[data-alumno="${P}-hijo2"]`).count(), 0);
  ok("el alumno nuevo aparece con su casillero vacío", await profe.locator(`[data-alumno="${nuevo.id}"] input[type="number"]`).inputValue(), "");
  ok("aviso de quién se sumó", await profe.locator("[data-aviso-nomina]:has-text('Pruebaav inscribió a Nuevoav Pruebaav en este curso')").count(), 1);
  ok("aviso de quién se fue", await profe.locator("[data-aviso-nomina]:has-text('Lunaav Pruebaav ya no está en este curso')").count(), 1);

  // Guardar manda solo los alumnos actuales
  await profe.click("button:has-text('Guardar notas')");
  await profe.waitForTimeout(1500);
  ok("se guardó la nota de Tomasav", q(`select nota from "Calificacion" where "evaluacionId"='${ev.id}' and "alumnoId"='${P}-hijo1'`), "8");
  ok("no se mandó la de Lunaav", q(`select count(*) from "Calificacion" where "evaluacionId"='${ev.id}' and "alumnoId"='${P}-hijo2'`), "0");

  // Asistencia: también avisa cuando cambia la nómina
  const asistencia = await navegador.newPage({ viewport: { width: 1280, height: 900 } });
  await entrar(asistencia, "profe");
  await asistencia.goto(`${BASE}/asistencia?curso=${P}-curso`);
  await asistencia.waitForSelector("button[aria-pressed]");
  await pedir("PATCH", `/api/alumnos/${P}-hijo2`, secreTk, { estado: "activo" });
  await asistencia.waitForTimeout(2500);
  ok("asistencia: aviso de quién volvió", await asistencia.locator("[data-aviso-nomina]:has-text('Lunaav Pruebaav')").count(), 1);

  // El admin le pasa el curso a otro profesor: aviso fijo y no se puede guardar
  await nota(profe, "hijo1").fill("9");
  const adminTk = await loginApi("admin");
  await pedir("PATCH", `/api/cursos/${P}-curso`, adminTk, { profesorId: `${P}-multi` });
  await profe.waitForTimeout(2500);
  ok("calificaciones: el curso ya no está a su cargo", await profe.locator("text=Este curso ya no está a tu cargo").count(), 1);
  ok("calificaciones: no se puede guardar", await profe.locator("button:has-text('Guardar notas')").isDisabled(), true);
  ok("asistencia: el curso ya no está a su cargo", await asistencia.locator("text=Este curso ya no está a tu cargo").count(), 1);
  await navegador.close();
  q(`delete from "Inscripcion" where "alumnoId"='${nuevo.id}'`);
})();
