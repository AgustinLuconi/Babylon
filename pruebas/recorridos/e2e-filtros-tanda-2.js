// Tanda 2 de filtros en la dirección: Reportes, Cursos, Observaciones del profesor y las pestañas del legajo. Cada enlace trae
// la pantalla con lo elegido, recargar lo conserva, un valor inválido o ajeno cae en el de por defecto y cambiar un filtro no
// agrega entradas al historial.
const { chromium } = require("playwright");
const ok = (e, r, x) => console.log(`${e}: ${r} (esperado ${x})`);
const BASE = "http://localhost:5173";
const P = "prueba-tmp-av";
const email = (x) => `${P}-${x}@prueba.babylon.test`;
const CLAVE = "prueba1234";

(async () => {
  const b = await chromium.launch({ executablePath: "/usr/bin/google-chrome" });
  try {
    const nueva = async () => (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
    const entrar = async (p, quien) => {
      await p.goto(`${BASE}/login`);
      await p.fill('input[name="email"]', email(quien));
      await p.fill('input[name="password"]', CLAVE);
      await p.click('button[type="submit"]');
      await p.waitForURL((u) => !u.pathname.startsWith("/login"));
    };
    const valores = (p) => p.$$eval("select", (els) => els.map((e) => e.value));
    const query = (p) => new URL(p.url()).searchParams;
    const activa = (p, nombre) => p.getByRole("button", { name: nombre, exact: true }).evaluate((el) => getComputedStyle(el).boxShadow !== "none");

    // ── Administrador ──
    const admin = await nueva();
    await entrar(admin, "admin");

    // Reportes
    await admin.goto(`${BASE}/reportes?pestana=financiero&ciclo=todos`);
    await admin.getByRole("button", { name: "Financiero", exact: true }).waitFor();
    ok("Reportes: el enlace abre la pestaña Financiero", await activa(admin, "Financiero"), true);
    ok("Reportes: y el ciclo 'todos'", (await valores(admin)).includes("todos"), true);
    await admin.reload();
    await admin.getByRole("button", { name: "Financiero", exact: true }).waitFor();
    ok("Reportes: recargar conserva la pestaña", await activa(admin, "Financiero"), true);
    await admin.getByRole("button", { name: "Anual", exact: true }).click();
    ok("Reportes: elegir otra pestaña la escribe en la dirección", query(admin).get("pestana"), "anual");
    await admin.getByRole("button", { name: "Cierre académico", exact: true }).click();
    ok("Reportes: la pestaña por defecto no deja rastro", query(admin).get("pestana"), null);
    await admin.getByRole("button", { name: "2° Cierre (Noviembre)", exact: true }).click();
    ok("Reportes: el período queda en la dirección", query(admin).get("periodo"), "noviembre");
    await admin.goto(`${BASE}/reportes?pestana=cualquiera&ciclo=no-existe&periodo=xx`);
    await admin.getByRole("button", { name: "Cierre académico", exact: true }).waitFor();
    await admin.waitForTimeout(800);
    ok("Reportes: valores inválidos caen en los de siempre", `${await activa(admin, "Cierre académico")} ${(await valores(admin)).includes("activo")}`, "true true");

    // Cursos
    await admin.goto(`${BASE}/cursos-todos?nivel=kids&ciclo=todos`);
    await admin.waitForSelector("select");
    ok("Cursos: el enlace trae el nivel y el ciclo", `${(await valores(admin)).includes("kids")} ${(await valores(admin)).includes("todos")}`, "true true");
    await admin.reload();
    await admin.waitForSelector("select");
    ok("Cursos: recargar los conserva", (await valores(admin)).includes("kids"), true);
    await admin.goto(`${BASE}/cursos-todos?nivel=zzz&profesor=ajeno`);
    await admin.waitForSelector("select");
    await admin.waitForTimeout(800);
    ok("Cursos: un nivel o profesor inexistente vuelve a 'todos'", `${(await valores(admin)).includes("zzz")} ${(await valores(admin)).includes("ajeno")}`, "false false");
    const largo = await admin.evaluate(() => history.length);
    await admin.locator("select").first().selectOption({ index: 1 }).catch(() => undefined);
    ok("Cursos: cambiar un filtro no suma entradas al historial", (await admin.evaluate(() => history.length)) - largo, 0);

    // Legajo
    await admin.goto(`${BASE}/alumnos/${P}-hijo1?pestana=academico&periodo=noviembre`);
    await admin.getByRole("button", { name: "2° Cierre · Noviembre", exact: true }).waitFor();
    ok("Legajo: el enlace abre Académico en Noviembre", await admin.getByRole("button", { name: "2° Cierre · Noviembre", exact: true }).evaluate((el) => el.className.includes("bg-background")), true);
    ok("Legajo: Académico muestra los períodos", await admin.getByRole("button", { name: "1° Cierre · Julio", exact: true }).count(), 1);
    await admin.reload();
    await admin.getByRole("button", { name: "1° Cierre · Julio", exact: true }).waitFor();
    ok("Legajo: recargar conserva pestaña y período", `${query(admin).get("pestana")} ${query(admin).get("periodo")}`, "academico noviembre");
    await admin.getByRole("button", { name: "Observaciones", exact: true }).click();
    ok("Legajo: cambiar de pestaña la escribe", query(admin).get("pestana"), "observaciones");
    await admin.getByRole("button", { name: "Información", exact: true }).click();
    ok("Legajo: la pestaña inicial no deja rastro", query(admin).get("pestana"), null);
    await admin.goto(`${BASE}/alumnos/${P}-hijo1?pestana=inventada`);
    await admin.getByRole("button", { name: "Información", exact: true }).waitFor();
    ok("Legajo: una pestaña inventada cae en Información", await admin.getByRole("button", { name: "1° Cierre · Julio", exact: true }).count(), 0);

    // ── Profesor: Observaciones ──
    const profe = await nueva();
    await entrar(profe, "profe");
    await profe.goto(`${BASE}/observaciones?curso=${P}-curso&alumno=${P}-hijo2`);
    await profe.waitForSelector("select");
    await profe.waitForFunction((id) => [...document.querySelectorAll("select")].some((s) => s.value === id), `${P}-hijo2`, { timeout: 8000 });
    ok("Observaciones: el enlace abre ese alumno", (await valores(profe)).includes(`${P}-hijo2`), true);
    await profe.reload();
    await profe.waitForFunction((id) => [...document.querySelectorAll("select")].some((s) => s.value === id), `${P}-hijo2`, { timeout: 8000 });
    ok("Observaciones: recargar lo conserva", (await valores(profe)).includes(`${P}-hijo2`), true);
    await profe.goto(`${BASE}/observaciones?curso=curso-ajeno&alumno=alumno-ajeno`);
    await profe.waitForFunction((id) => [...document.querySelectorAll("select")].some((s) => s.value === id), `${P}-curso`, { timeout: 8000 });
    ok("Observaciones: un curso ajeno cae en el primero propio", (await valores(profe)).includes(`${P}-curso`), true);
    ok("Observaciones: un alumno ajeno no se abre", (await valores(profe)).includes("alumno-ajeno"), false);
    ok("Observaciones: la dirección no guarda el texto escrito", query(profe).has("texto"), false);
  } finally {
    await b.close();
  }
})();
