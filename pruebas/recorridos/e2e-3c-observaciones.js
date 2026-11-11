// Las observaciones muestran quién las escribió y con qué rol, en las tres pantallas. Antes: _mundo-avisos.ts crear.
const { chromium } = require("playwright");
const ok = (e, r, x) => console.log(`${e}: ${r} (esperado ${x})`);
const BASE = "http://localhost:5173";
const API = "http://localhost:4000";
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
const AUTOR = "Pruebaav secre · Secretaría";
(async () => {
  const secre = await loginApi("secre");
  await fetch(`${API}/api/observaciones`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${secre}` }, body: JSON.stringify({ alumnoId: "prueba-tmp-av-hijo1", texto: "Trajo la autorización firmada", categoria: "administrativo" }) });
  const navegador = await chromium.launch({ executablePath: "/usr/bin/google-chrome" });
  const admin = await navegador.newPage({ viewport: { width: 1280, height: 900 } });
  await entrar(admin, "admin");
  await admin.goto(`${BASE}/alumnos/prueba-tmp-av-hijo1`);
  await admin.click("button:has-text('Observaciones')");
  await admin.waitForTimeout(1200);
  ok("legajo: autor y rol", await admin.locator(`text=${AUTOR}`).count(), 1);
  const padre = await navegador.newPage();
  await entrar(padre, "padre");
  await padre.goto(`${BASE}/mis-hijos?hijo=prueba-tmp-av-hijo1`);
  await padre.waitForTimeout(1500);
  ok("padre: autor y rol", (await padre.locator(`text=${AUTOR}`).count()) > 0 ? "sí" : "no", "sí");
  const profe = await navegador.newPage({ viewport: { width: 1280, height: 900 } });
  await entrar(profe, "profe");
  await profe.goto(`${BASE}/observaciones`);
  await profe.waitForTimeout(1200);
  await profe.selectOption("select >> nth=1", "prueba-tmp-av-hijo1");
  await profe.waitForTimeout(1200);
  ok("profesor: autor y rol", await profe.locator(`text=${AUTOR}`).count(), 1);
  await navegador.close();
})();
