// Cambios en vivo entre administración y secretaría. Antes: _mundo-avisos.ts crear.
const { chromium } = require("playwright");
const { execSync } = require("child_process");
const ok = (e, r, x) => console.log(`${e}: ${r} (esperado ${x})`);
const S = require("node:path").join(__dirname, "..", "bin");
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
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(`${API}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: email(quien), password: "prueba1234" }) });
      return (await r.json()).token;
    } catch {
      await new Promise((r) => setTimeout(r, 300));
    }
  }
}
const pedir = (metodo, ruta, token, cuerpo) => fetch(`${API}${ruta}`, { method: metodo, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: cuerpo ? JSON.stringify(cuerpo) : undefined });
const cuota = (id, alumno, mes) =>
  q(`insert into "Cuota"(id,"alumnoId",mes,anio,"montoBase",descuento,"montoFinal",vencimiento,estado) values ('prueba-tmp-av-${id}','prueba-tmp-av-${alumno}',${mes},2026,1000,0,1000,'2026-0${mes}-10','vencida')`);
const filas = (p, texto) => p.locator(`tbody tr:has-text("${texto}")`).count();

(async () => {
  cuota("cv1", "hijo1", 9);
  cuota("cv8", "hijo1", 8);
  for (const m of [3, 4, 5, 6, 7]) cuota(`cb${m}`, "hijo2", m);
  const navegador = await chromium.launch({ executablePath: "/usr/bin/google-chrome" });
  const admin = await navegador.newPage({ viewport: { width: 1280, height: 900 } });
  await entrar(admin, "admin");
  await admin.goto(`${BASE}/cuotas?pestana=vencidas`);
  await admin.waitForSelector('tbody tr:has-text("Tomasav")');
  const secre = await navegador.newPage();
  await entrar(secre, "secre");
  await secre.goto(`${BASE}/cuotas`);
  await secre.waitForTimeout(1500);
  const secreTk = await loginApi("secre");

  // 1) La secretaria cobra: en la pantalla del admin la fila sale sola y aparece quién lo hizo
  const antes = await filas(admin, "Tomasav");
  await pedir("POST", "/api/cuotas/pagos", secreTk, { cuotaIds: ["prueba-tmp-av-cv1"], metodo: "efectivo" });
  await admin.waitForTimeout(3000);
  ok("1: la fila cobrada sale de Vencidas sin recargar", await filas(admin, "Tomasav"), antes - 1);
  ok("1: mensaje con quién y qué", await admin.locator("[data-mensaje-cambio]:has-text('Pruebaav cobró la cuota de septiembre de Tomasav Pruebaav')").count(), 1);
  ok("1: a quien lo hizo no le aparece el mensaje", await secre.locator("[data-mensaje-cambio]").count(), 0);

  // 2) Cinco cobros seguidos: un solo mensaje y una sola recarga de la lista
  let pedidosDeCuotas = 0;
  admin.on("request", (r) => {
    if (new URL(r.url()).pathname === "/api/cuotas") pedidosDeCuotas++;
  });
  // Los cinco pedidos salen a la vez: lo que se prueba es que el navegador junta las señales, no cuánto tarda cada cobro en el servidor
  // (con las automatizaciones cada cobro revisa reglas y tarda más que los 300 ms de espera del navegador entre señales).
  await Promise.all([3, 4, 5, 6, 7].map((m) => pedir("POST", "/api/cuotas/pagos", secreTk, { cuotaIds: [`prueba-tmp-av-cb${m}`], metodo: "efectivo" })));
  await admin.waitForTimeout(2500);
  ok("2: un solo mensaje para los cinco", await admin.locator("[data-mensaje-cambio]:has-text('Pruebaav cobró 5 cuotas')").count(), 1);
  ok("2: una sola recarga de la lista", pedidosDeCuotas, 1);

  // 3) Con la conexión en vivo cortada no llega; al reconectarse, la lista se pone al día
  await admin.route("**/api/tiempo-real", (r) => r.abort());
  execSync(`bash "${S}/reiniciar-api.sh"`);
  const secreTk2 = await loginApi("secre");
  await pedir("POST", "/api/cuotas/pagos", secreTk2, { cuotaIds: ["prueba-tmp-av-cv8"], metodo: "efectivo" });
  await admin.waitForTimeout(3000);
  ok("3: sin conexión no se entera", await filas(admin, "Tomasav"), antes - 1);
  await admin.unroute("**/api/tiempo-real");
  await admin.waitForTimeout(35000);
  ok("3: al reconectarse se pone al día", await filas(admin, "Tomasav"), antes - 2);

  // 4) Mi cuenta: una sesión nueva de la misma cuenta aparece en la lista sin recargar
  await admin.goto(`${BASE}/mi-cuenta`);
  await admin.waitForTimeout(1500);
  const sesiones = await admin.locator("tbody tr").count();
  await loginApi("admin");
  await admin.waitForTimeout(2000);
  ok("4: la sesión nueva aparece sola", await admin.locator("tbody tr").count(), sesiones + 1);
  await navegador.close();
})();
