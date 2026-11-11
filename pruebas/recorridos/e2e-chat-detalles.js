// Detalles menores de la revisión final. Antes: _mundo-avisos.ts crear + el padre sin cuenta (prep-instituto.sh).
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
const sinVer = (chatId) => q(`select count(*) from "Mensaje" where "chatId"='${chatId}' and "vistoEn" is null`);

(async () => {
  const navegador = await chromium.launch({ executablePath: "/usr/bin/google-chrome" });
  const adminTk = await loginApi("admin");
  const padreTk = await loginApi("padre");
  const chatId = (await (await pedir("GET", "/api/chats/mio", padreTk)).json()).id;

  // 1) Conversación larga: se cargan los últimos 50; abrirla marca leído todo (también lo anterior a lo cargado)
  q(`insert into "Mensaje"(id,"chatId","emisorId","rolEmisor",texto,fecha) select 'prueba-tmp-av-largo-' || n, '${chatId}', 'prueba-tmp-av-admin', 'secretario', 'Mensaje viejo ' || n, timestamp '2026-10-01 10:00' + n * interval '1 minute' from generate_series(1, 55) n`);
  const padre = await navegador.newPage();
  await entrar(padre, "padre");
  await padre.goto(`${BASE}/chat`);
  await padre.waitForTimeout(2000);
  ok("1: se cargan los últimos 50", await padre.locator("[data-mensaje]").count(), 50);
  ok("1: abrirla marca leídos los 55, también los no cargados", sinVer(chatId), "0");
  await padre.click("button:has-text('Ver mensajes anteriores')");
  await padre.waitForTimeout(1200);
  ok("1: a pedido se cargan los anteriores", await padre.locator("[data-mensaje]").count(), 55);
  ok("1: y ya no hay más", await padre.locator("button:has-text('Ver mensajes anteriores')").count(), 0);
  // Lo que se estaba leyendo (el primero que estaba cargado) sigue a la vista: no salta al principio ni al final
  const aLaVista = await padre.evaluate(() => {
    const m = [...document.querySelectorAll("[data-mensaje]")].find((e) => e.textContent.includes("Mensaje viejo 6"));
    const caja = m.closest(".overflow-y-auto").getBoundingClientRect();
    const r = m.getBoundingClientRect();
    return r.bottom > caja.top && r.top < caja.bottom;
  });
  ok("1: cargar los anteriores no hace saltar la vista", aLaVista ? "sí" : "no", "sí");

  // 2) Si falla marcar leído, se reintenta solo
  let fallas = 0;
  await padre.route("**/leido", (r) => (fallas++ === 0 ? r.fulfill({ status: 500, body: "{}" }) : r.continue()));
  await pedir("POST", `/api/chats/${chatId}/mensajes`, adminTk, { texto: "Para reintentar" });
  await padre.waitForTimeout(9000);
  ok("2: falló una vez", fallas >= 1 ? "sí" : "no", "sí");
  ok("2: y se reintentó solo", sinVer(chatId), "0");

  // 3) Una conversación nueva aparece sola en la lista del resto del equipo
  const admin = await navegador.newPage({ viewport: { width: 1280, height: 860 } });
  await entrar(admin, "admin");
  await admin.goto(`${BASE}/chats`);
  await admin.waitForSelector("[data-conversacion]");
  // Una familia sin cuenta (el mundo de prueba no la trae): se crea por la API y el mundo la limpia (nombre "Pruebaav").
  const sinCuenta = await (await pedir("POST", "/api/padres", adminTk, { nombre: "Pruebaav", apellido: "Sincuenta", telefono: "351 555-1234", dni: "99400150" })).json();
  const nueva = (await (await pedir("POST", "/api/chats", adminTk, { padreId: sinCuenta.id })).json()).id;
  await admin.waitForTimeout(1500);
  ok("3: la conversación nueva aparece sola", await admin.locator(`[data-conversacion="${nueva}"]`).count(), 1);

  // 4) Cuenta desactivada: el aviso lo dice (no "todavía no entró")
  q(`update "Usuario" set estado='inactivo' where id='prueba-tmp-av-ajeno'`);
  await admin.click('button:has-text("Nueva conversación")');
  await admin.fill('input[placeholder^="Buscar por nombre"]', "ajeno");
  await admin.click('[data-padre-opcion]:has-text("ajeno")');
  await admin.waitForTimeout(1000);
  ok("4: cuenta desactivada", await admin.locator("text=La cuenta está desactivada: no puede entrar al sistema, así que no va a ver la conversación hasta que se reactive.").count(), 1);
  ok("4: no dice que todavía no entró", await admin.locator("text=Todavía no entró al sistema").count(), 0);
  q(`update "Usuario" set estado='activo' where id='prueba-tmp-av-ajeno'`);
  await navegador.close();
})();
