// Editar y borrar mensajes del chat, en el navegador: la familia corrige y borra lo suyo, el instituto lo ve cambiar en vivo,
// cualquiera de administración o secretaría corrige un mensaje del instituto, y pasado el plazo desaparece el menú.
const { chromium } = require("playwright");
const { execFileSync } = require("node:child_process");
const ok = (e, r, x) => console.log(`${e}: ${r} (esperado ${x})`);
const BASE = "http://localhost:5173";
const email = (x) => `prueba-tmp-av-${x}@prueba.babylon.test`;
const sql = (q) => execFileSync("docker", ["exec", "babylon-postgres", "psql", "-U", "babylon", "-d", "babylon", "-tAc", q]).toString().trim();
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
  const tiene = (p, texto) => p.waitForFunction((t) => document.body.textContent.includes(t), texto, { timeout: 8000 });
  const burbuja = (p, texto) => p.locator("[data-mensaje]", { hasText: texto });
  const abrirConversacion = async (p) => {
    await p.goto(`${BASE}/chats`);
    await p.locator("[data-conversacion]", { hasText: "Pruebaav" }).first().click();
    await p.waitForSelector("[data-conversacion-abierta]");
  };
  try {
    const familia = await abrir("padre");
    await familia.goto(`${BASE}/chat`);
    const caja = familia.getByPlaceholder("Escribí tu consulta…");
    await caja.waitFor();
    await caja.fill("Mensaje con errror");
    await caja.press("Enter");
    await tiene(familia, "Mensaje con errror");

    const secre = await abrir("secre");
    await abrirConversacion(secre);
    await tiene(secre, "Mensaje con errror");

    // La familia corrige lo suyo.
    await burbuja(familia, "Mensaje con errror").locator("[data-menu-mensaje]").click();
    await familia.locator("[data-accion-editar]").click();
    const edicion = familia.locator("[data-editar-texto]");
    await edicion.press("Escape");
    ok("Esc cancela la edición", (await familia.locator("[data-editar-texto]").count()) === 0 && (await tiene(familia, "Mensaje con errror")) !== null, true);
    await burbuja(familia, "Mensaje con errror").locator("[data-menu-mensaje]").click();
    await familia.locator("[data-accion-editar]").click();
    await familia.locator("[data-editar-texto]").fill("Mensaje sin error");
    await familia.locator("[data-editar-texto]").press("Enter");
    await burbuja(familia, "Mensaje sin error").locator("[data-editado]").waitFor({ timeout: 8000 });
    ok("la familia ve su mensaje corregido y '(editado)'", await burbuja(familia, "Mensaje sin error").locator("[data-editado]").count(), 1);
    await tiene(secre, "Mensaje sin error");
    ok("el instituto lo ve corregido en vivo, con '(editado)'", await burbuja(secre, "Mensaje sin error").locator("[data-editado]").count(), 1);
    ok("el instituto no puede tocar el mensaje de la familia", await burbuja(secre, "Mensaje sin error").locator("[data-menu-mensaje]").count(), 0);

    // El instituto responde; la familia no puede tocar lo del instituto.
    const resp = secre.getByPlaceholder("Escribir un mensaje…");
    await resp.fill("Respuesta del institto");
    await resp.press("Enter");
    await tiene(familia, "Respuesta del institto");
    ok("la familia no puede tocar el mensaje del instituto", await burbuja(familia, "Respuesta del institto").locator("[data-menu-mensaje]").count(), 0);
    await burbuja(secre, "Respuesta del institto").first().waitFor({ timeout: 8000 });
    ok("secretaría puede tocar el suyo", await burbuja(secre, "Respuesta del institto").locator("[data-menu-mensaje]").count(), 1);

    // Otra cuenta del instituto (administración) corrige el mensaje de secretaría.
    const admin = await abrir("admin");
    await abrirConversacion(admin);
    await tiene(admin, "Respuesta del institto");
    await burbuja(admin, "Respuesta del institto").locator("[data-menu-mensaje]").click();
    await admin.locator("[data-accion-editar]").click();
    await admin.locator("[data-editar-texto]").fill("Respuesta del instituto");
    await admin.locator("[data-editar-texto]").press("Enter");
    await tiene(familia, "Respuesta del instituto");
    ok("la familia ve la respuesta corregida por otra cuenta del instituto", await burbuja(familia, "Respuesta del instituto").locator("[data-editado]").count(), 1);

    // Borrar: confirmación, aviso y en vivo para el otro lado.
    await burbuja(familia, "Mensaje sin error").locator("[data-menu-mensaje]").click();
    await familia.locator("[data-accion-eliminar]").click();
    await familia.locator("[data-confirmar-eliminar]").waitFor();
    await familia.locator("[data-confirmar]").click();
    await familia.locator("[data-eliminado]").waitFor();
    ok("la familia ve 'Se eliminó este mensaje'", await familia.locator("[data-eliminado]").count(), 1);
    await secre.locator("[data-eliminado]").waitFor({ timeout: 8000 });
    ok("el instituto lo ve eliminado en vivo", (await secre.textContent("body")).includes("Mensaje sin error"), false);
    ok("el texto original no está en la base", sql("select count(*) from \"Mensaje\" where texto like 'Mensaje sin error%' or texto like 'Mensaje con errror%'"), "0");

    // Pasado el plazo, no hay menú.
    sql("update \"Mensaje\" set fecha = now() - interval '16 minutes' where texto = 'Respuesta del instituto'");
    await familia.reload();
    await tiene(familia, "Respuesta del instituto");
    await secre.reload();
    await tiene(secre, "Respuesta del instituto");
    ok("secretaría ya no puede tocar un mensaje de hace 16 minutos", await burbuja(secre, "Respuesta del instituto").locator("[data-menu-mensaje]").count(), 0);
  } finally {
    await b.close();
  }
})();
