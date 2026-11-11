// Hallazgos de la revisión final. Antes: _mundo-avisos.ts crear.
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
  const r = await fetch(`${API}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: email(quien), password: "prueba1234" }) });
  return (await r.json()).token;
}
const pedir = (metodo, ruta, token, cuerpo) => fetch(`${API}${ruta}`, { method: metodo, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: cuerpo ? JSON.stringify(cuerpo) : undefined });
const ocultar = (p, oculta) =>
  p.evaluate((o) => {
    Object.defineProperty(document, "visibilityState", { value: o ? "hidden" : "visible", configurable: true });
    document.dispatchEvent(new Event("visibilitychange", { bubbles: true }));
  }, oculta);

(async () => {
  const navegador = await chromium.launch({ executablePath: "/usr/bin/google-chrome" });
  const adminTk = await loginApi("admin");
  const padreTk = await loginApi("padre");
  const chatId = (await (await pedir("GET", "/api/chats/mio", padreTk)).json()).id;

  // 1) Un mensaje que se confirma después pero con una fecha anterior al último que se ve (dos envíos casi a la vez)
  const padre = await navegador.newPage();
  await entrar(padre, "padre");
  await padre.goto(`${BASE}/chat`);
  await padre.waitForTimeout(1200);
  await pedir("POST", `/api/chats/${chatId}/mensajes`, adminTk, { texto: "El último que se ve" });
  await padre.waitForTimeout(1500);
  ok("1: el último se marcó leído", q(`select count(*) from "Mensaje" where "chatId"='${chatId}' and "vistoEn" is null`), "0");
  q(`insert into "Mensaje"(id,"chatId","emisorId","rolEmisor",texto,fecha) select 'prueba-tmp-av-tarde','${chatId}','prueba-tmp-av-admin','secretario','Confirmado tarde', max(fecha) - interval '1 second' from "Mensaje" where "chatId"='${chatId}'`);
  await ocultar(padre, true);
  await ocultar(padre, false);
  await padre.waitForTimeout(2000);
  ok("1: aparece en pantalla", (await padre.locator("text=Confirmado tarde").count()) > 0 ? "sí" : "no", "sí");
  ok("1: y se marca leído aunque el último no cambió", q(`select count(*) from "Mensaje" where id='prueba-tmp-av-tarde' and "vistoEn" is null`), "0");

  // 2) Lo que llega mientras la conexión en vivo está cortada aparece al reconectarse. La página no puede reconectarse
  // mientras dura el corte (se bloquea su conexión en vivo), así el mensaje llega sí o sí sin señal.
  await padre.route("**/api/tiempo-real", (r) => r.abort());
  execSync(`bash "${S}/reiniciar-api.sh"`);
  await pedir("POST", `/api/chats/${chatId}/mensajes`, adminTk, { texto: "Enviado durante el corte" });
  await padre.waitForTimeout(3000);
  ok("2: durante el corte no aparece", (await padre.locator("text=Enviado durante el corte").count()) > 0 ? "sí" : "no", "no");
  await padre.unroute("**/api/tiempo-real");
  await padre.waitForTimeout(35000);
  ok("2: al reconectarse aparece lo que llegó durante el corte", (await padre.locator("text=Enviado durante el corte").count()) > 0 ? "sí" : "no", "sí");

  // 3) Un borrador no pasa a otra conversación
  const ajeno = (await (await pedir("POST", "/api/chats", adminTk, { padreId: "prueba-tmp-av-ajeno" })).json()).id;
  const admin = await navegador.newPage({ viewport: { width: 1280, height: 860 } });
  await entrar(admin, "admin");
  await admin.goto(`${BASE}/chats?conversacion=${chatId}`);
  await admin.waitForSelector("[data-conversacion-abierta]");
  await admin.fill('input[placeholder^="Escribir un mensaje"]', "Borrador para la familia Pruebaav padre");
  await admin.click(`[data-conversacion="${ajeno}"]`);
  // Desde el 3c, cambiar de conversación con un borrador pregunta antes: se elige salir.
  await admin.click("button:has-text('Salir sin guardar')");
  await admin.waitForTimeout(800);
  ok("3: al cambiar de conversación el borrador no se lleva", await admin.inputValue('input[placeholder^="Escribir un mensaje"]'), "");
  await navegador.close();
})();
