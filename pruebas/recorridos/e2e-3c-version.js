// Aviso de versión nueva: deja terminar, recomienda guardar y después exige recargar. Antes: _mundo-avisos.ts crear.
const { chromium } = require("playwright");
const { execSync } = require("child_process");
const ok = (e, r, x) => console.log(`${e}: ${r} (esperado ${x})`);
const S = require("node:path").join(__dirname, "..", "bin");
const BASE = "http://localhost:5173";
const FRANJA = "Hay una versión nueva del sistema. Guardá lo que estés haciendo y después recargá la página para evitar errores.";
const email = (x) => `prueba-tmp-av-${x}@prueba.babylon.test`;
async function entrar(p, quien) {
  await p.goto(`${BASE}/login`);
  await p.fill('input[name="email"]', email(quien));
  await p.fill('input[name="password"]', "prueba1234");
  await p.click('button[type="submit"]');
  await p.waitForURL((u) => !u.pathname.startsWith("/login"));
}
// La página cree que hay una versión nueva del client publicada; reiniciar la API corta la conexión y al reconectarse
// la página vuelve a comprobar.
async function versionNuevaDelClient(p) {
  await p.route("**/version.json*", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ version: "otra" }) }));
  execSync(`bash "${S}/reiniciar-api.sh"`);
  await p.waitForTimeout(12000);
}

(async () => {
  const navegador = await chromium.launch({ executablePath: "/usr/bin/google-chrome" });
  const p = await navegador.newPage({ viewport: { width: 1280, height: 900 } });
  await entrar(p, "secre");
  await p.goto(`${BASE}/alumnos/prueba-tmp-av-hijo1`);
  await p.click("button:has-text('Observaciones')");
  await p.click("button:has-text('Nueva observación')");
  await p.fill(".fixed.inset-0 textarea", "Escrita antes del aviso");

  // 1) Aparece la franja y deja terminar lo que se estaba haciendo
  await versionNuevaDelClient(p);
  ok("1: aparece la franja", await p.locator(`text=${FRANJA}`).count(), 1);
  ok("1: con el botón Recargar ahora", await p.locator("button:has-text('Recargar ahora')").count(), 1);
  ok("1: lo que se estaba escribiendo sigue ahí", await p.locator(".fixed.inset-0 textarea").inputValue(), "Escrita antes del aviso");

  // 2) Al guardar con éxito, exige recargar
  await p.click(".fixed.inset-0 button:has-text('Enviar')");
  await p.waitForTimeout(1500);
  ok("2: aparece el cartel", await p.locator("text=Recargá para seguir").count(), 1);
  ok("2: con su explicación", await p.locator("text=Hay una versión nueva del sistema. Para seguir usándolo sin errores, recargá la página.").count(), 1);
  await p.unroute("**/version.json*");
  const recarga = p.waitForEvent("load");
  await p.click("button:has-text('Recargar'):not(:has-text('ahora'))");
  await recarga;
  await p.waitForTimeout(2000);
  ok("2: después de recargar no hay aviso", await p.locator(`text=${FRANJA}`).count(), 0);

  // 3) Con la franja y nada sin guardar, ir a otra pantalla recarga en esa pantalla
  await versionNuevaDelClient(p);
  const recarga2 = p.waitForEvent("load");
  await p.click("nav a:has-text('Cuotas')");
  await recarga2;
  ok("3: navegar recarga la página en la pantalla pedida", new URL(p.url()).pathname, "/cuotas");

  // 4) Con algo sin guardar, antes pregunta
  // (un borrador del chat: con un modal abierto, su fondo tapa el menú)
  const login = await fetch("http://localhost:4000/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: email("secre"), password: "prueba1234" }) });
  const { token } = await login.json();
  const chat = await (await fetch("http://localhost:4000/api/chats", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ padreId: "prueba-tmp-av-padre" }) })).json();
  await p.goto(`${BASE}/chats?conversacion=${chat.id}`);
  await p.waitForSelector("[data-conversacion-abierta]");
  await versionNuevaDelClient(p);
  await p.fill('input[placeholder^="Escribir un mensaje"]', "Sin guardar");
  await p.click("nav a:has-text('Cuotas')");
  await p.waitForTimeout(500);
  ok("4: con algo sin guardar, pregunta antes de recargar", await p.locator("text=Tenés cambios sin guardar. ¿Salir igual?").count(), 1);
  await p.click("button:has-text('Seguir editando')");
  await p.unroute("**/version.json*");

  // 5) También cuando cambia la versión del servidor (sin tocar la del client)
  const q = await navegador.newPage();
  execSync(`APP_VERSION=prueba-1 bash "${S}/reiniciar-api.sh"`);
  await entrar(q, "admin");
  await q.waitForTimeout(2000);
  execSync(`APP_VERSION=prueba-2 bash "${S}/reiniciar-api.sh"`);
  await q.waitForTimeout(12000);
  ok("5: una versión nueva del servidor también avisa", await q.locator(`text=${FRANJA}`).count(), 1);
  execSync(`bash "${S}/reiniciar-api.sh"`);
  await navegador.close();
})();
