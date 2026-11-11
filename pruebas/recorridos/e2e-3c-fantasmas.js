// Dos cambios ajenos seguidos (menos de 1,5 s entre uno y otro) no dejan filas "saliendo" para siempre. Antes: crear.
const { chromium } = require("playwright");
const { execSync } = require("child_process");
const ok = (e, r, x) => console.log(`${e}: ${r} (esperado ${x})`);
const BASE = "http://localhost:5173";
const API = "http://localhost:4000";
const q = (sql) => execSync(`docker exec babylon-postgres psql -U babylon -d babylon -tAc "${sql.replace(/"/g, '\\"')}"`).toString().trim();
const email = (x) => `prueba-tmp-av-${x}@prueba.babylon.test`;
(async () => {
  for (const [id, al] of [["g1", "hijo1"], ["g2", "hijo2"]])
    q(`insert into "Cuota"(id,"alumnoId",mes,anio,"montoBase",descuento,"montoFinal",vencimiento,estado) values ('prueba-tmp-av-${id}','prueba-tmp-av-${al}',9,2026,1000,0,1000,'2026-09-10','vencida')`);
  const b = await chromium.launch({ executablePath: "/usr/bin/google-chrome" });
  const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
  await p.goto(`${BASE}/login`);
  await p.fill('input[name="email"]', email("admin"));
  await p.fill('input[name="password"]', "prueba1234");
  await p.click('button[type="submit"]');
  await p.waitForURL((u) => !u.pathname.startsWith("/login"));
  await p.goto(`${BASE}/cuotas?pestana=vencidas`);
  await p.waitForSelector('tbody tr:has-text("Tomasav")');
  const r = await fetch(`${API}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: email("secre"), password: "prueba1234" }) });
  const { token } = await r.json();
  const cobrar = (id) => fetch(`${API}/api/cuotas/pagos`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ cuotaIds: [`prueba-tmp-av-${id}`], metodo: "efectivo" }) });
  await cobrar("g1");
  await p.waitForTimeout(700);
  await cobrar("g2");
  await p.waitForTimeout(4000);
  ok("no quedan filas fantasma", await p.locator("tbody tr.fila-saliendo").count(), 0);
  ok("las dos cobradas ya no están", await p.locator('tbody tr:has-text("Tomasav"), tbody tr:has-text("Lunaav")').count(), 0);
  await b.close();
})();
