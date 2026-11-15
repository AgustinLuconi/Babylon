// 3d, Tarea 12: datos incompletos — marca y filtro en Alumnos, aviso de la campana, cartel del legajo y actualización en
// vivo entre dos pestañas.
const { chromium } = require("playwright");
const { execSync } = require("child_process");
const ok = (e, r, x) => console.log(`${e}: ${r} (esperado ${x})`);
const BASE = "http://localhost:5173";
const API = "http://localhost:4000";
const q = (sql) => execSync(`docker exec babylon-postgres psql -U babylon -d babylon -tAc "${sql.replace(/"/g, '\\"')}"`).toString().trim();
const email = (x) => `prueba-tmp-av-${x}@prueba.babylon.test`;
const P = "prueba-tmp-av";
// La lista pagina de a 8 y el ciclo activo ya tiene todos los alumnos reales: se busca por el apellido de los de prueba para verlos.
const buscar = (p) => p.getByPlaceholder("Buscar por nombre, apellido o DNI…").fill("Pruebaav");

(async () => {
  const b = await chromium.launch({ executablePath: "/usr/bin/google-chrome" });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 1100 } });
  const a = await ctx.newPage();
  try {
    await a.goto(`${BASE}/login`);
    await a.fill('input[name="email"]', email("secre"));
    await a.fill('input[name="password"]', "prueba1234");
    await a.click('button[type="submit"]');
    await a.waitForURL((u) => !u.pathname.startsWith("/login"));

    // Un cambio por la API para que se calcule el aviso (los datos del mundo se crearon directo en la base).
    const r = await fetch(`${API}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: email("admin"), password: "prueba1234" }) });
    const admin = (await r.json()).token;
    await fetch(`${API}/api/alumnos/${P}-hijo2`, { method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${admin}` }, body: JSON.stringify({ direccion: "Calle 9" }) });

    // 1. Filtro y marca
    await a.goto(`${BASE}/alumnos?ciclo=activo&datos=incompletos`);
    await buscar(a);
    await a.waitForSelector("[data-datos-incompletos]");
    const fila = a.locator("tr", { hasText: "Tomasav" }).first();
    ok("lista: el alumno figura con la marca", await fila.locator("[data-datos-incompletos]").count(), 1);
    ok("lista: la marca detalla lo que falta", await fila.locator("[data-datos-incompletos]").getAttribute("title"), "Falta: Vínculo con el responsable, Celular del responsable, Email del responsable");
    ok("lista: el filtro viene puesto desde la dirección", await a.getByLabel("Datos").inputValue(), "incompletos");
    // Un alumno completo no figura con el filtro
    q(`update "Padre" set telefono='+5493515551234', email='mama@prueba.test' where id='${P}-ajeno'`);
    q(`update "Alumno" set "vinculoResponsable"='madre' where id='${P}-alumno-ajeno'`);
    await fetch(`${API}/api/alumnos/${P}-alumno-ajeno`, { method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${admin}` }, body: JSON.stringify({ direccion: "Calle 1" }) });
    await a.goto(`${BASE}/alumnos?ciclo=activo&datos=incompletos`);
    await buscar(a);
    await a.waitForSelector("[data-datos-incompletos]");
    ok("lista: un alumno completo no figura con el filtro", await a.locator("tr", { hasText: "Ajenoav" }).count(), 0);
    await a.getByLabel("Datos").selectOption("todos");
    await a.waitForTimeout(400);
    ok("lista: sin el filtro figura sin marca", await a.locator("tr", { hasText: "Ajenoav" }).first().locator("[data-datos-incompletos]").count(), 0);

    // 2. Aviso de la campana
    await a.goto(`${BASE}/dashboard`);
    await a.getByRole("button", { name: /Notificaciones/ }).click();
    const aviso = a.locator("[data-notificacion]", { hasText: "datos incompletos" }).first();
    await aviso.waitFor();
    ok("campana: el aviso dice cuántos alumnos", /Hay \d+ alumnos? con datos incompletos/.test(await aviso.textContent()), true);
    await aviso.click();
    await a.waitForURL(/\/alumnos\?.*datos=incompletos/);
    ok("campana: lleva a la lista ya filtrada", new URL(a.url()).searchParams.get("datos"), "incompletos");

    // 3. Legajo: cartel y completar. Una segunda pestaña mira la lista filtrada y se actualiza sola.
    const b2 = await ctx.newPage();
    await b2.goto(`${BASE}/alumnos?ciclo=activo&datos=incompletos`);
    await buscar(b2);
    await b2.locator("tr", { hasText: "Tomasav" }).first().waitFor();
    await a.goto(`${BASE}/alumnos/${P}-hijo1`);
    const cartel = a.locator("[data-datos-incompletos]");
    await cartel.waitFor();
    ok("legajo: el cartel lista lo que falta", (await cartel.textContent()).includes("Vínculo con el responsable, Celular del responsable, Email del responsable"), true);
    await cartel.getByRole("button", { name: "Elegir el vínculo" }).click();
    await a.locator("div.fixed").getByText("Pruebaav padre").first().click();
    await a.selectOption("#vinculoExistente", "madre");
    await a.getByRole("button", { name: "Guardar", exact: true }).click();
    await a.waitForTimeout(1200);
    ok("legajo: con el vínculo, falta el celular y el email del responsable", (await cartel.textContent()).includes("Faltan completar: Celular del responsable, Email del responsable"), true);
    await cartel.getByRole("button", { name: "Completar datos" }).click();
    await a.locator("#responsable-telefono").fill("351 555-1234");
    await a.locator("#responsable-email").fill("mama@prueba.test");
    await a.getByRole("button", { name: "Guardar cambios" }).click();
    await a.waitForTimeout(1500);
    ok("legajo: completo, el cartel desaparece", await a.locator("[data-datos-incompletos]").count(), 0);
    await b2.waitForTimeout(3500);
    ok("otra pestaña: la lista filtrada se actualizó sola", await b2.locator("tr", { hasText: "Tomasav" }).count(), 0);
  } finally {
    await b.close();
  }
})();
