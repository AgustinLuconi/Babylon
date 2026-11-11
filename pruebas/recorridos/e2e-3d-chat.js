// El chat sigue andando tras cambiar sus campos de texto: la familia escribe, el instituto lo ve y responde; tope de 2000.
const { chromium } = require("playwright");
const ok = (e, r, x) => console.log(`${e}: ${r} (esperado ${x})`);
const BASE = "http://localhost:5173";
const email = (x) => `prueba-tmp-av-${x}@prueba.babylon.test`;
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
  try {
    const familia = await abrir("padre");
    await familia.goto(`${BASE}/chat`);
    const caja = familia.getByPlaceholder("Escribí tu consulta…");
    await caja.waitFor();
    ok("chat de la familia: el tope de largo del mensaje", await caja.getAttribute("maxlength"), "2000");
    await caja.fill("Hola desde la familia");
    await caja.press("Enter");
    await familia.waitForSelector("[data-mensaje]");
    ok("chat de la familia: el mensaje enviado aparece", (await familia.textContent("body")).includes("Hola desde la familia"), true);

    const instituto = await abrir("secre");
    await instituto.goto(`${BASE}/chats`);
    await instituto.locator("[data-conversacion]", { hasText: "Pruebaav" }).first().click();
    await instituto.waitForSelector("[data-conversacion-abierta]");
    ok("chat del instituto: ve el mensaje de la familia", (await instituto.textContent("body")).includes("Hola desde la familia"), true);
    const respuesta = instituto.getByPlaceholder("Escribir un mensaje…");
    ok("chat del instituto: el tope de largo del mensaje", await respuesta.getAttribute("maxlength"), "2000");
    await respuesta.fill("Respuesta del instituto");
    await respuesta.press("Enter");
    await familia.waitForFunction(() => document.body.textContent.includes("Respuesta del instituto"), null, { timeout: 8000 });
    ok("chat: la respuesta le llega en vivo a la familia", (await familia.textContent("body")).includes("Respuesta del instituto"), true);
  } finally {
    await b.close();
  }
})();
