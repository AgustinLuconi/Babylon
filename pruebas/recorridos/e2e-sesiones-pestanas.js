// Cada pestaña tiene su propia sesión: dos pestañas del mismo navegador pueden estar con cuentas distintas, recargar conserva
// la sesión, cerrar sesión en una no toca a la otra, una pestaña nueva arranca sin sesión y ya no existe "Mantener sesión iniciada".
const { chromium } = require("playwright");
const ok = (e, r, x) => console.log(`${e}: ${r} (esperado ${x})`);
const BASE = "http://localhost:5173";
const email = (x) => `prueba-tmp-av-${x}@prueba.babylon.test`;
const CLAVE = "prueba1234";

(async () => {
  const b = await chromium.launch({ executablePath: "/usr/bin/google-chrome" });
  try {
    const contexto = await b.newContext({ viewport: { width: 1280, height: 900 } });
    const entrar = async (p, quien) => {
      await p.goto(`${BASE}/login`);
      await p.fill('input[name="email"]', email(quien));
      await p.fill('input[name="password"]', CLAVE);
      await p.click('button[type="submit"]');
      await p.waitForURL((u) => !u.pathname.startsWith("/login"));
    };
    const quien = async (p) => (await p.evaluate(() => JSON.parse(sessionStorage.getItem("babylon-session") || "null")))?.state?.usuario?.email;

    const login = await contexto.newPage();
    await login.goto(`${BASE}/login`);
    ok("la pantalla de ingreso ya no ofrece 'Mantener sesión iniciada'", ((await login.textContent("body")) ?? "").includes("Mantener sesión"), false);
    await login.close();

    const a = await contexto.newPage();
    const c = await contexto.newPage();
    await entrar(a, "padre");
    await entrar(c, "admin");
    ok("la pestaña A tiene la cuenta de la familia", await quien(a), email("padre"));
    ok("la pestaña B tiene la del administrador, en el mismo navegador", await quien(c), email("admin"));
    ok("nada queda en localStorage", await a.evaluate(() => localStorage.getItem("babylon-session")), null);

    await a.reload();
    await c.reload();
    await a.waitForTimeout(800);
    ok("recargar A conserva su sesión", `${new URL(a.url()).pathname.startsWith("/login")} ${await quien(a)}`, `false ${email("padre")}`);
    ok("recargar B conserva su sesión", `${new URL(c.url()).pathname.startsWith("/login")} ${await quien(c)}`, `false ${email("admin")}`);

    const nueva = await contexto.newPage();
    await nueva.goto(`${BASE}/dashboard`);
    await nueva.waitForURL((u) => u.pathname.startsWith("/login"), { timeout: 8000 });
    ok("una pestaña nueva arranca sin sesión", new URL(nueva.url()).pathname, "/login");
    await nueva.close();

    // Cerrar sesión en B no toca a A.
    await c.getByRole("button", { name: /cerrar sesi/i }).first().click();
    await c.waitForURL((u) => u.pathname.startsWith("/login"), { timeout: 8000 });
    ok("B cerró su sesión", new URL(c.url()).pathname, "/login");
    await a.reload();
    await a.waitForTimeout(1000);
    ok("A sigue con su sesión", `${new URL(a.url()).pathname.startsWith("/login")} ${await quien(a)}`, `false ${email("padre")}`);
    const yo = await a.evaluate(async () => {
      const t = JSON.parse(sessionStorage.getItem("babylon-session")).state.token;
      return (await fetch("http://localhost:4000/api/auth/yo", { headers: { Authorization: `Bearer ${t}` } })).status;
    });
    ok("y su token sigue valiendo en el servidor", yo, 200);
  } finally {
    await b.close();
  }
})();
