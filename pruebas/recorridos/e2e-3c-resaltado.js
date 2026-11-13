// Resaltado breve de lo que cambió. Antes: _mundo-avisos.ts crear.
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
const pedir = async (metodo, ruta, token, cuerpo) => {
  const r = await fetch(`${API}${ruta}`, { method: metodo, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: cuerpo ? JSON.stringify(cuerpo) : undefined });
  const t = await r.text();
  return t ? JSON.parse(t) : null;
};
const cuota = (id, alumno, mes) =>
  q(`insert into "Cuota"(id,"alumnoId",mes,anio,"montoBase",descuento,"montoFinal",vencimiento,estado) values ('prueba-tmp-av-${id}','prueba-tmp-av-${alumno}',${mes},2026,1000,0,1000,'2026-0${mes}-10','vencida')`);

(async () => {
  cuota("r1", "hijo1", 9);
  cuota("r2", "hijo1", 8);
  cuota("r3", "hijo2", 7);
  const navegador = await chromium.launch({ executablePath: "/usr/bin/google-chrome" });
  const [secre, admin, profe] = [await loginApi("secre"), await loginApi("admin"), await loginApi("profe")];

  // Panel del admin: un número que cambia por un cobro de la secretaria se ilumina
  const panel = await navegador.newPage({ viewport: { width: 1280, height: 900 } });
  await entrar(panel, "admin");
  await panel.goto(`${BASE}/dashboard`);
  await panel.waitForTimeout(2000);
  await pedir("POST", "/api/cuotas/pagos", secre, { cuotaIds: ["prueba-tmp-av-r1"], metodo: "efectivo" });
  await panel.waitForTimeout(1500);
  ok("panel: el número que cambió se ilumina", (await panel.locator(".cambio-resaltado").count()) > 0 ? "sí" : "no", "sí");
  await panel.waitForTimeout(3500);
  ok("panel: y se apaga solo", await panel.locator(".cambio-resaltado").count(), 0);
  await pedir("POST", "/api/cuotas/pagos", admin, { cuotaIds: ["prueba-tmp-av-r3"], metodo: "efectivo" });
  await panel.waitForTimeout(1500);
  ok("panel: un cobro propio no resalta nada", await panel.locator(".cambio-resaltado").count(), 0);

  // Cuotas vencidas: la fila que sale se desvanece y después ya no está
  const cuotas = await navegador.newPage({ viewport: { width: 1280, height: 900 } });
  await entrar(cuotas, "admin");
  await cuotas.goto(`${BASE}/cuotas?pestana=vencidas`);
  await cuotas.waitForSelector('tbody tr:has-text("Tomasav")');
  await pedir("POST", "/api/cuotas/pagos", secre, { cuotaIds: ["prueba-tmp-av-r2"], metodo: "efectivo" });
  await cuotas.waitForTimeout(1000);
  ok("cuotas: la fila que sale se desvanece", await cuotas.locator('tbody tr.fila-saliendo:has-text("Tomasav")').count(), 1);
  await cuotas.waitForTimeout(2500);
  ok("cuotas: y después ya no está", await cuotas.locator('tbody tr:has-text("Tomasav")').count(), 0);

  // Padre: una nota publicada entra resaltada en su lista
  const padre = await navegador.newPage();
  await entrar(padre, "padre");
  await padre.goto(`${BASE}/mis-hijos/calificaciones?hijo=prueba-tmp-av-hijo1`);
  await padre.waitForTimeout(2000);
  const ev = await pedir("POST", "/api/calificaciones/evaluaciones", profe, { cursoId: "prueba-tmp-av-curso", nombre: "Speaking", tipo: "oral", fecha: "2026-10-20", periodo: "noviembre" });
  await pedir("POST", `/api/calificaciones/evaluaciones/${ev.id}/calificaciones`, profe, { notas: [{ alumnoId: "prueba-tmp-av-hijo1", nota: "9" }] });
  await pedir("PATCH", `/api/calificaciones/evaluaciones/${ev.id}/publicar`, profe);
  await padre.waitForTimeout(1500);
  ok("padre: la nota nueva entra resaltada", await padre.locator(".fila-entrando:has-text('Speaking')").count(), 1);
  await navegador.close();
})();
