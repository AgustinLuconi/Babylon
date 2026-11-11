// Las cuentas las administra el administrador: Sin cuenta → Crear cuenta (con el email de la ficha ya completado), la familia
// entra con la contraseña asignada, el administrador edita contraseña y roles (y la sesión de la familia se cierra sola), crea
// un usuario con varios roles y el aviso de "ese email ya tiene cuenta". Y ya no existe nada de recuperación ni cambio propio.
const { chromium } = require("playwright");
const ok = (e, r, x) => console.log(`${e}: ${r} (esperado ${x})`);
const BASE = "http://localhost:5173";
const API = "http://localhost:4000";
const email = (x) => `prueba-tmp-av-${x}@prueba.babylon.test`;
const CLAVE = "prueba1234";

(async () => {
  const b = await chromium.launch({ executablePath: "/usr/bin/google-chrome" });
  const nueva = async () => (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  const entrar = async (p, quien, password = CLAVE) => {
    await p.goto(`${BASE}/login`);
    await p.fill('input[name="email"]', quien.includes("@") ? quien : email(quien));
    await p.fill('input[name="password"]', password);
    await p.click('button[type="submit"]');
  };
  const entrarYEsperar = async (p, quien, password = CLAVE) => {
    await entrar(p, quien, password);
    await p.waitForURL((u) => !u.pathname.startsWith("/login"));
  };
  const token = async (quien) => {
    const r = await fetch(`${API}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: email(quien), password: CLAVE }) });
    return (await r.json()).token;
  };
  const texto = async (p) => (await p.textContent("body")) ?? "";
  const esperarTexto = (p, t) => p.waitForFunction((x) => document.body.textContent.includes(x), t, { timeout: 8000 });

  try {
    // La secretaría da de alta un responsable con email de contacto (sin cuenta).
    const secreToken = await token("secre");
    const alta = await fetch(`${API}/api/padres`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${secreToken}` },
      body: JSON.stringify({ nombre: "Pruebaav", apellido: "Fichae2e", telefono: "351 555-1234", email: email("ficha-e2e") }),
    });
    ok("la secretaría da de alta al responsable (sin cuenta)", alta.status, 201);

    // ── El administrador crea la cuenta desde "Sin cuenta" ──
    const admin = await nueva();
    await entrarYEsperar(admin, "admin");
    await admin.goto(`${BASE}/usuarios?pestana=sin-cuenta`);
    const fila = admin.locator("[data-sin-cuenta]", { hasText: "Fichae2e" });
    await fila.waitFor();
    ok("Sin cuenta lista al responsable con el email de su ficha", (await fila.textContent()).includes(email("ficha-e2e")), true);
    await fila.getByRole("button", { name: "Crear cuenta" }).click();
    await admin.waitForSelector("[data-email]");
    ok("el email de la ficha viene autocompletado", await admin.locator("[data-email]").inputValue(), email("ficha-e2e"));
    ok("la contraseña viene vacía", await admin.locator("#cuentaPassword").inputValue(), "");
    await admin.locator("#cuentaPassword").fill("corta");
    await admin.locator("[data-crear-cuenta]").click();
    await esperarTexto(admin, "al menos 8 caracteres");
    ok("una contraseña corta se rechaza en pantalla", (await texto(admin)).includes("al menos 8 caracteres"), true);
    await admin.locator("#cuentaPassword").fill("claveE2e123");
    await admin.locator("[data-crear-cuenta]").click();
    await esperarTexto(admin, "Cuenta creada para Pruebaav Fichae2e");
    ok("aviso de cuenta creada", true, true);
    await admin.locator("[data-sin-cuenta]", { hasText: "Fichae2e" }).waitFor({ state: "detached", timeout: 8000 });
    ok("la persona sale de Sin cuenta", await admin.locator("[data-sin-cuenta]", { hasText: "Fichae2e" }).count(), 0);

    // ── La familia entra con la contraseña asignada ──
    const familia = await nueva();
    await entrarYEsperar(familia, email("ficha-e2e"), "claveE2e123");
    ok("la familia entra con la contraseña que le dio el administrador", new URL(familia.url()).pathname.startsWith("/login"), false);
    await familia.waitForTimeout(1500); // que su conexión en vivo esté abierta

    // ── Editar: contraseña nueva ──
    await admin.goto(`${BASE}/usuarios`);
    const cuenta = admin.locator("[data-cuenta]", { hasText: email("ficha-e2e") });
    await cuenta.waitFor();
    await cuenta.locator("[data-editar-cuenta]").click();
    await admin.waitForSelector("#editarPassword");
    ok("el nombre de una cuenta de responsable no se edita acá", await admin.locator("[data-nombre]").isDisabled(), true);
    await admin.locator("#editarPassword").fill("claveE2e456");
    await admin.locator("[data-guardar-cuenta]").click();
    await esperarTexto(admin, "Cambios guardados");
    await familia.waitForURL((u) => u.pathname.startsWith("/login"), { timeout: 10000 });
    ok("la sesión de la familia se cierra sola al cambiar la contraseña", new URL(familia.url()).searchParams.get("motivo"), "contrasena-cambiada");
    await entrar(familia, email("ficha-e2e"), "claveE2e123");
    await esperarTexto(familia, "incorrectos");
    ok("la contraseña vieja ya no sirve", true, true);
    await entrarYEsperar(familia, email("ficha-e2e"), "claveE2e456");
    ok("la nueva sí", new URL(familia.url()).pathname.startsWith("/login"), false);

    // ── Editar: agregar un rol → el ingreso pide elegir ──
    await cuenta.locator("[data-editar-cuenta]").click();
    await admin.waitForSelector("[data-rol=secretario]");
    await admin.locator("[data-rol=secretario]").check();
    await admin.locator("[data-guardar-cuenta]").click();
    await esperarTexto(admin, "Cambios guardados");
    const otra = await nueva();
    await entrar(otra, email("ficha-e2e"), "claveE2e456");
    await esperarTexto(otra, "Secretario");
    ok("con dos roles el ingreso pide elegir con cuál entrar", (await texto(otra)).includes("Secretario") && (await texto(otra)).includes("Responsable"), true);

    // ── Editar: quitar el rol de responsable (la ficha vuelve a Sin cuenta, pide confirmar) ──
    await cuenta.locator("[data-editar-cuenta]").click();
    await admin.waitForSelector("[data-rol=padre]");
    await admin.locator("[data-rol=padre]").uncheck();
    ok("quitar el rol pide confirmación y bloquea el guardado", `${await admin.locator("[data-confirmar-quitar]").count()} ${await admin.locator("[data-guardar-cuenta]").isDisabled()}`, "1 true");
    await admin.locator("[data-confirmar-quitar] input").check();
    await admin.locator("[data-guardar-cuenta]").click();
    await esperarTexto(admin, "Cambios guardados");
    await admin.goto(`${BASE}/usuarios?pestana=sin-cuenta`);
    await admin.locator("[data-sin-cuenta]", { hasText: "Fichae2e" }).waitFor({ timeout: 8000 });
    ok("la ficha del responsable vuelve a Sin cuenta", await admin.locator("[data-sin-cuenta]", { hasText: "Fichae2e" }).count(), 1);

    // ── Crear usuario: secretario nuevo, y el aviso cuando el email ya tiene cuenta ──
    await admin.locator("[data-crear-usuario]").click();
    await admin.waitForSelector("[data-rol=secretario]");
    await admin.locator("[data-rol=secretario]").check();
    await admin.locator("[data-nombre]").fill("Pruebaav Secrenueva");
    await admin.locator("[data-email]").fill(email("secre-e2e"));
    await admin.locator("#cuentaPassword").fill("claveE2e789");
    await admin.locator("[data-crear-cuenta]").click();
    await esperarTexto(admin, "Cuenta creada para Pruebaav Secrenueva");
    ok("Crear usuario crea un secretario", true, true);
    await admin.locator("[data-crear-usuario]").click();
    await admin.waitForSelector("[data-rol=profesor]");
    await admin.locator("[data-rol=profesor]").check();
    await admin.locator("[data-email]").fill(email("secre-e2e"));
    await admin.locator("[data-aviso-existente]").waitFor({ timeout: 8000 });
    ok("avisa que ese email ya tiene cuenta", (await admin.locator("[data-aviso-existente]").textContent()).includes("ya tiene cuenta"), true);
    ok("y no pide contraseña", await admin.locator("#cuentaPassword").count(), 0);

    // ── Lo que ya no existe ──
    const anonimo = await nueva();
    for (const ruta of ["/olvide-contrasena", "/restablecer-contrasena?token=x", "/activar-cuenta?token=x", "/verificar-email?token=x"]) {
      await anonimo.goto(`${BASE}${ruta}`);
      await anonimo.waitForTimeout(500);
      ok(`${ruta.split("?")[0]} ya no ofrece nada`, /Restablec|Recuper|Activar|Verific/i.test(await texto(anonimo)), false);
    }
    await anonimo.goto(`${BASE}/login`);
    ok("la pantalla de ingreso no tiene '¿Olvidaste tu contraseña?'", (await texto(anonimo)).includes("¿Olvidaste tu contraseña?"), false);
    ok("y explica a quién pedirla", (await texto(anonimo)).includes("pedísela a la administración"), true);
    const propia = await nueva();
    await entrarYEsperar(propia, "secre");
    await propia.goto(`${BASE}/mi-cuenta`);
    await propia.waitForSelector("text=Sesiones");
    ok("Mi cuenta no permite cambiar la contraseña ni verificar el email", /Cambiar contraseña|Verificar|verific/i.test(await texto(propia)), false);
    ok("y explica a quién pedirlo", (await texto(propia)).includes("pedíselo a la administración"), true);
  } finally {
    await b.close();
  }
})();
