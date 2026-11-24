// Clase sin dictar: el profesor marca una clase como "sin clases" (con motivo, confirmando con Enter) y la quita; la familia la ve
// en su calendario y en el detalle del mes SIN el motivo; secretaría la ve en el legajo CON el motivo; mientras está marcada no se
// puede tomar asistencia y no queda ninguna fila de asistencia.
const { chromium } = require("playwright");
const { execSync } = require("child_process");
const ok = (e, r, x) => console.log(`${e}: ${r} (esperado ${x})`);
const BASE = "http://localhost:5173";
const P = "prueba-tmp-av";
const MOTIVO = "Corte de luz de la prueba";
const q = (sql) => execSync(`docker exec babylon-postgres psql -U babylon -d babylon -tAc "${sql.replace(/"/g, '\\"')}"`).toString().trim();
const email = (x) => `${P}-${x}@prueba.babylon.test`;
const dia = (atras) => {
  const d = new Date();
  d.setDate(d.getDate() - atras);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
async function entrar(p, quien) {
  await p.goto(`${BASE}/login`);
  await p.fill('input[name="email"]', email(quien));
  await p.fill('input[name="password"]', "prueba1234");
  await p.click('button[type="submit"]');
  await p.waitForURL((u) => !u.pathname.startsWith("/login"));
}

(async () => {
  const FECHA = dia(2);
  const marcas = () => q(`select count(*) from "ClaseSinDictar" where "cursoId"='${P}-curso' and fecha='${FECHA}'`);
  const filas = () => q(`select count(*) from "Asistencia" where "cursoId"='${P}-curso' and fecha='${FECHA}'`);
  const b = await chromium.launch({ executablePath: "/usr/bin/google-chrome" });
  const profe = await b.newPage({ viewport: { width: 1280, height: 1200 } });
  const padre = await b.newPage({ viewport: { width: 1280, height: 1400 } });
  const secre = await b.newPage({ viewport: { width: 1280, height: 1400 } });
  try {
    await entrar(profe, "profe");

    // 0. Lo que se había tildado antes de marcar la clase no queda como "sin guardar": no hay nada que guardar en una clase sin dar
    await profe.goto(`${BASE}/asistencia?curso=${P}-curso&fecha=${FECHA}`);
    await profe.locator("[data-alumno]").first().getByRole("button", { name: "Presente" }).click();
    await profe.getByRole("button", { name: "Marcar sin clases" }).click();
    await profe.locator("#motivo-sin-clases").fill(MOTIVO);
    await profe.locator("#motivo-sin-clases").press("Enter");
    await profe.locator("[data-clase-sin-dictar]").waitFor({ timeout: 8000 });
    await profe.locator('input[type="date"]').first().fill(dia(3));
    await profe.waitForTimeout(800);
    ok("profesor: tras marcar la clase, cambiar de día no pregunta por cambios sin guardar", `${await profe.getByText("Tenés cambios sin guardar").count()} ${new URL(profe.url()).searchParams.get("fecha")}`, `0 ${dia(3)}`);
    await profe.goto(`${BASE}/asistencia?curso=${P}-curso&fecha=${FECHA}`);
    await profe.getByRole("button", { name: "Quitar marca" }).click();
    await profe.locator("[data-alumno]").first().waitFor({ timeout: 8000 });

    // 1. El profesor marca la clase (Enter en el motivo confirma)
    await profe.goto(`${BASE}/asistencia?curso=${P}-curso&fecha=${FECHA}`);
    await profe.getByRole("button", { name: "Marcar sin clases" }).click();
    const motivo = profe.locator("#motivo-sin-clases");
    await motivo.fill(MOTIVO);
    await motivo.press("Enter");
    await profe.locator("[data-clase-sin-dictar]").waitFor({ timeout: 8000 });
    ok("profesor: aparece la tarjeta 'Clase sin dar' con el motivo", (await profe.locator("[data-clase-sin-dictar]").innerText()).includes(MOTIVO), true);
    ok("profesor: hay una marca y ninguna fila de asistencia ese día", `${marcas()} ${filas()}`, "1 0");
    ok("profesor: no se puede guardar asistencia (no hay barra de guardado ni tarjetas de alumnos)", `${await profe.getByRole("button", { name: /Confirmar asistencia|Guardar asistencia|Guardar borrador/ }).count()} ${await profe.locator("[data-alumno]").count()}`, "0 0");
    ok("profesor: ya no ofrece marcar sin clases", await profe.getByRole("button", { name: "Marcar sin clases" }).count(), 0);

    // 2. La familia la ve en el calendario y en el detalle del mes, sin el motivo
    await entrar(padre, "padre");
    await padre.goto(`${BASE}/mis-hijos/asistencia`);
    await padre.locator('[title="Sin clases"]').first().waitFor({ timeout: 10000 });
    ok("familia: ve el día como 'Sin clases' en el calendario", await padre.locator('[title="Sin clases"]').count(), 1);
    ok("familia: el detalle del mes lo lista como 'Sin clases'", await padre.getByText("Sin clases", { exact: true }).count() >= 1, true);
    ok("familia: el motivo no aparece en ningún lado de la página", (await padre.locator("body").innerText()).includes(MOTIVO) || (await padre.content()).includes(MOTIVO), false);

    // 3. Secretaría la ve en el legajo, con el motivo
    await entrar(secre, "secre");
    await secre.goto(`${BASE}/alumnos/${P}-hijo1`);
    await secre.click("button:has-text('Asistencia')");
    await secre.locator(`[title="Sin clases: ${MOTIVO}"]`).first().waitFor({ timeout: 10000 });
    ok("secretaría: el legajo muestra el día sin clases con su motivo", await secre.locator(`[title="Sin clases: ${MOTIVO}"]`).count(), 1);

    // 4. El profesor quita la marca: la grilla vuelve y la familia deja de verla
    await profe.getByRole("button", { name: "Quitar marca" }).click();
    await profe.locator("[data-alumno]").first().waitFor({ timeout: 8000 });
    ok("profesor: al quitar la marca vuelven las tarjetas de los alumnos", await profe.locator("[data-alumno]").count() > 0, true);
    ok("profesor: la marca ya no está en la base", marcas(), "0");
    await padre.reload();
    await padre.getByText("Detalle del mes").waitFor({ timeout: 10000 });
    ok("familia: al recargar, el día ya no figura como 'Sin clases'", await padre.locator('[title="Sin clases"]').count(), 0);
  } finally {
    await b.close();
    q(`delete from "ClaseSinDictar" where "cursoId" = '${P}-curso' and fecha = '${FECHA}'`);
  }
})().catch((e) => { console.log(`sin excepciones: ${e.message.split("\n").slice(0, 4).join(" | ")} (esperado ninguna)`); process.exit(1); });
