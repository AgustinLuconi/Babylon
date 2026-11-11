// El padre ve al día la asistencia y las cuotas de su hijo, con quién hizo qué; otra familia no se entera de nada.
// Antes: _mundo-avisos.ts crear.
const { chromium } = require("playwright");
const { execSync } = require("child_process");
const ok = (e, r, x) => console.log(`${e}: ${r} (esperado ${x})`);
const BASE = "http://localhost:5173";
const API = "http://localhost:4000";
const q = (sql) => execSync(`docker exec babylon-postgres psql -U babylon -d babylon -tAc "${sql.replace(/"/g, '\\"')}"`).toString().trim();
const email = (x) => `prueba-tmp-av-${x}@prueba.babylon.test`;
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
const pedir = (metodo, ruta, token, cuerpo) => fetch(`${API}${ruta}`, { method: metodo, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: cuerpo ? JSON.stringify(cuerpo) : undefined });

(async () => {
  q(`insert into "Cuota"(id,"alumnoId",mes,anio,"montoBase",descuento,"montoFinal",vencimiento,estado) values ('prueba-tmp-av-cp','prueba-tmp-av-hijo1',9,2026,1000,0,1000,'2026-09-10','vencida')`);
  const navegador = await chromium.launch({ executablePath: "/usr/bin/google-chrome" });
  const asistencia = await navegador.newPage({ viewport: { width: 1280, height: 900 } });
  await entrar(asistencia, "padre");
  await asistencia.goto(`${BASE}/mis-hijos/asistencia?hijo=prueba-tmp-av-hijo1`);
  const cuotas = await navegador.newPage({ viewport: { width: 1280, height: 900 } });
  await entrar(cuotas, "padre");
  await cuotas.goto(`${BASE}/mis-hijos/cuotas?hijo=prueba-tmp-av-hijo1`);
  const ajeno = await navegador.newPage();
  await entrar(ajeno, "ajeno");
  await ajeno.goto(`${BASE}/mis-hijos`);
  await asistencia.waitForTimeout(2000);

  await pedir("POST", "/api/asistencia/masiva", await loginApi("profe"), { cursoId: "prueba-tmp-av-curso", fecha: new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10), registros: [{ alumnoId: "prueba-tmp-av-hijo1", estado: "presente" }, { alumnoId: "prueba-tmp-av-hijo2", estado: "presente" }] });
  await asistencia.waitForTimeout(1500);
  ok("asistencia: el registro nuevo entra resaltado", await asistencia.locator(".fila-entrando").count(), 1);
  ok("asistencia: mensaje con quién", await asistencia.locator("[data-mensaje-cambio]:has-text('Pruebaav tomó asistencia')").count(), 1);

  await pedir("POST", "/api/cuotas/pagos", await loginApi("secre"), { cuotaIds: ["prueba-tmp-av-cp"], metodo: "efectivo" });
  await cuotas.waitForTimeout(2000);
  ok("cuotas: la cuota cobrada figura pagada", (await cuotas.locator("text=Pagada").count()) > 0 ? "sí" : "no", "sí");
  ok("cuotas: mensaje con quién y qué", await cuotas.locator("[data-mensaje-cambio]:has-text('Pruebaav cobró la cuota de septiembre de Tomasav Pruebaav')").count(), 1);
  ok("otra familia no se entera de nada", await ajeno.locator("[data-mensaje-cambio]").count(), 0);
  await navegador.close();
})();
