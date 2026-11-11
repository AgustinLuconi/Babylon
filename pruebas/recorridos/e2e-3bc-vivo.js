// Lo "en vivo" de 3b y 3c en el navegador: el chat (aviso en la lista y en la campana del instituto, "Visto" para la familia,
// ningún aviso para quien escribe) y los cambios ajenos (aviso "quién hizo qué" y datos que se ponen al día solos).
const { chromium } = require("playwright");
const ok = (e, r, x) => console.log(`${e}: ${r} (esperado ${x})`);
const BASE = "http://localhost:5173";
const API = "http://localhost:4000";
const email = (x) => `prueba-tmp-av-${x}@prueba.babylon.test`;
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch({ executablePath: "/usr/bin/google-chrome" });
  const abrir = async (quien) => {
    const p = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
    await p.goto(`${BASE}/login`);
    await p.fill('input[name="email"]', email(quien));
    await p.fill('input[name="password"]', "prueba1234");
    await p.click('button[type="submit"]');
    await p.waitForURL((u) => !u.pathname.startsWith("/login"));
    return p;
  };
  const tokenDe = async (quien) => {
    const r = await fetch(`${API}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: email(quien), password: "prueba1234" }) });
    return (await r.json()).token;
  };
  try {
    // ── 3b: chat ──
    const instituto = await abrir("secre");
    await instituto.goto(`${BASE}/chats`);
    await instituto.waitForSelector("text=Conversaciones", { timeout: 8000 }).catch(() => undefined);
    const familia = await abrir("padre");
    await familia.goto(`${BASE}/chat`);
    const caja = familia.getByPlaceholder("Escribí tu consulta…");
    await caja.waitFor();
    await caja.fill("Consulta de prueba 3b");
    await caja.press("Enter");
    await familia.waitForSelector("[data-mensaje]");
    // El instituto, sin tocar nada, se entera: la conversación marca no leídos y la campana suma el aviso.
    await instituto.waitForSelector("[data-conversacion] [data-no-leidos]", { timeout: 8000 });
    ok("instituto: la lista marca la conversación con un mensaje sin leer", (await instituto.locator("[data-conversacion] [data-no-leidos]").first().textContent()).trim(), "1");
    await instituto.waitForFunction(() => /^[1-9]/.test(document.querySelector("[data-contador]")?.textContent ?? ""), null, { timeout: 8000 });
    ok("instituto: la campana suma el aviso", true, true);
    const campanaFamilia = await familia.locator("[data-contador]").count();
    ok("familia: quien escribe no recibe aviso de su mensaje", campanaFamilia, 0);

    // Al abrir la conversación se marca leída y la familia ve "Visto".
    await instituto.locator("[data-conversacion]", { hasText: "Pruebaav" }).first().click();
    await instituto.waitForSelector("[data-conversacion-abierta]");
    await familia.waitForSelector("[data-visto]", { timeout: 8000 });
    ok("familia: ve 'Visto' bajo su último mensaje", (await familia.locator("[data-visto]").last().textContent()).includes("Visto"), true);
    await instituto.waitForFunction(() => document.querySelectorAll("[data-conversacion] [data-no-leidos]").length === 0, null, { timeout: 8000 });
    ok("instituto: al abrirla deja de figurar sin leer", await instituto.locator("[data-conversacion] [data-no-leidos]").count(), 0);

    // ── 3c: cambios ajenos ──
    const admin = await abrir("admin");
    await admin.goto(`${BASE}/alumnos/prueba-tmp-av-hijo1`);
    await admin.waitForFunction(() => document.body.textContent.includes("Tomasav"), null, { timeout: 8000 });
    await esperar(1500); // que la conexión en vivo esté abierta
    const secre = await tokenDe("secre");
    const r = await fetch(`${API}/api/alumnos/prueba-tmp-av-hijo1`, { method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${secre}` }, body: JSON.stringify({ direccion: "Calle En Vivo 123" }) });
    ok("pedido de la secretaría", r.status, 200);
    await admin.waitForSelector("[data-mensaje-cambio]", { timeout: 8000 });
    const aviso = await admin.locator("[data-mensaje-cambio]").first().textContent();
    ok("administración: aviso de quién hizo el cambio", aviso.includes("Pruebaav actualizó los datos de Tomasav"), true);
    await admin.waitForFunction(() => document.body.textContent.includes("Calle En Vivo 123"), null, { timeout: 8000 });
    ok("administración: el legajo se puso al día sin recargar", true, true);
    ok("la secretaría que hizo el cambio no recibe el aviso de sí misma", await instituto.locator("[data-mensaje-cambio]").count(), 0);
  } finally {
    await b.close();
  }
})();
