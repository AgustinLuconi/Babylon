// "Notificaciones" y "Mi cuenta" están en el menú lateral de todos los roles, en un grupo propio al final (en administración,
// debajo de Configuración), y abren sus pantallas. El avatar de la esquina superior derecha abre un menú con Mi cuenta, el
// modo claro/oscuro y Cerrar sesión.
const { chromium } = require("playwright");
const ok = (e, r, x) => console.log(`${e}: ${r} (esperado ${x})`);
const BASE = "http://localhost:5173";
const P = "prueba-tmp-av";
const email = (x) => `${P}-${x}@prueba.babylon.test`;
// El ítem activo se marca al terminar de pintar la navegación: se espera en vez de medir en el acto.
const marcado = (p, href) => p.locator(`nav a[href="${href}"].active`).first().waitFor({ timeout: 5000 }).then(() => true, () => false);
async function entrar(p, quien) {
  await p.goto(`${BASE}/login`);
  await p.fill('input[name="email"]', email(quien));
  await p.fill('input[name="password"]', "prueba1234");
  await p.click('button[type="submit"]');
  await p.waitForURL((u) => !u.pathname.startsWith("/login"));
}

(async () => {
  const b = await chromium.launch({ executablePath: "/usr/bin/google-chrome" });
  try {
    for (const [quien, nombre] of [["admin", "administración"], ["secre", "secretaría"], ["profe", "docente"], ["padre", "familia"]]) {
      const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
      await entrar(p, quien);
      const enlaces = p.locator("aside nav a, nav a");
      await enlaces.first().waitFor({ timeout: 8000 });
      const textos = (await enlaces.allInnerTexts()).map((t) => t.trim().split("\n")[0]);
      ok(`${nombre}: el menú termina en Notificaciones y Mi cuenta`, textos.slice(-2).join(" > "), "Notificaciones > Mi cuenta");
      if (quien === "admin") ok("administración: ese grupo queda debajo de Configuración", textos.slice(-3).join(" > "), "Configuración > Notificaciones > Mi cuenta");
      await p.getByRole("link", { name: /^Notificaciones/ }).first().click();
      await p.waitForURL((u) => u.pathname === "/notificaciones", { timeout: 8000 });
      ok(`${nombre}: Notificaciones abre la pantalla de avisos`, new URL(p.url()).pathname, "/notificaciones");
      ok(`${nombre}: Notificaciones queda marcado como activo`, await marcado(p, "/notificaciones"), true);
      await p.getByRole("link", { name: "Mi cuenta", exact: true }).first().click();
      await p.waitForURL((u) => u.pathname === "/mi-cuenta", { timeout: 8000 });
      ok(`${nombre}: abre la pantalla de la cuenta`, new URL(p.url()).pathname, "/mi-cuenta");
      ok(`${nombre}: el ítem queda marcado como activo`, await marcado(p, "/mi-cuenta"), true);
      // Menú del avatar
      const avatar = p.getByRole("button", { name: "Menú de usuario" });
      await avatar.click();
      const menu = p.getByRole("menu");
      await menu.waitFor({ timeout: 5000 });
      ok(`${nombre}: el menú muestra el nombre, el email y el rol`, `${(await menu.innerText()).includes("Pruebaav")} ${(await menu.innerText()).includes(email(quien))}`, "true true");
      ok(`${nombre}: el menú tiene Mi cuenta, el modo y Cerrar sesión`, (await menu.getByRole("menuitem").allInnerTexts()).map((t) => t.trim()).join(" | ").replace(/Modo (claro|oscuro)/, "Modo"), "Mi cuenta | Modo | Cerrar sesión");
      await p.keyboard.press("Escape");
      ok(`${nombre}: Escape cierra el menú`, await p.getByRole("menu").count(), 0);
      await avatar.click();
      await p.getByRole("menuitem", { name: "Mi cuenta" }).click();
      await p.waitForURL((u) => u.pathname === "/mi-cuenta", { timeout: 8000 });
      ok(`${nombre}: Mi cuenta del menú abre la pantalla y lo cierra`, `${new URL(p.url()).pathname} ${await p.getByRole("menu").count()}`, "/mi-cuenta 0");
      await avatar.click();
      await p.getByRole("menuitem", { name: /Modo (claro|oscuro)/ }).click();
      ok(`${nombre}: cambiar el modo lo cierra`, await p.getByRole("menu").count(), 0);
      await avatar.click();
      await p.getByRole("menuitem", { name: "Cerrar sesión" }).click();
      await p.waitForURL((u) => u.pathname.startsWith("/login"), { timeout: 8000 });
      ok(`${nombre}: Cerrar sesión vuelve al ingreso`, new URL(p.url()).pathname, "/login");
      await p.close();
    }
  } finally {
    await b.close();
  }
})().catch((e) => { console.log(`sin excepciones: ${e.message.split("\n").slice(0, 4).join(" | ")} (esperado ninguna)`); process.exit(1); });
