// Enter en los modales: en un campo de texto aprieta el botón principal del pie (si está habilitado); en un área de texto es un
// salto de línea; en el buscador del cobro no cobra; con el botón deshabilitado no hace nada. Sobre una cuota o un método de
// pago elegidos, Enter confirma (como una casilla: Espacio marca, Enter confirma). Las flechas mueven el foco entre los campos.
// Fuera de los modales, Enter guarda en los campos sueltos de Configuración: día de vencimiento, fechas del ciclo, número de una
// regla de automatizaciones y año de un ciclo nuevo.
const { chromium } = require("playwright");
const { execSync } = require("child_process");
const ok = (e, r, x) => console.log(`${e}: ${r} (esperado ${x})`);
const BASE = "http://localhost:5173";
const P = "prueba-tmp-av";
const q = (sql) => execSync(`docker exec babylon-postgres psql -U babylon -d babylon -tAc "${sql.replace(/"/g, '\\"')}"`).toString().trim();
const email = (x) => `${P}-${x}@prueba.babylon.test`;
async function entrar(p, quien) {
  await p.goto(`${BASE}/login`);
  await p.fill('input[name="email"]', email(quien));
  await p.fill('input[name="password"]', "prueba1234");
  await p.click('button[type="submit"]');
  await p.waitForURL((u) => !u.pathname.startsWith("/login"));
}

(async () => {
  const CICLO = `${P}-ciclo-enter`;
  const CUOTA = `${P}-cuota-enter`;
  const CUOTA2 = `${P}-cuota-enter2`;
  const inicioDePrueba = q("select now()");
  const diaOriginal = q(`select "diaVencimiento" from "Configuracion" limit 1`);
  const umbralOriginal = q(`select umbral from "Automatizacion" where regla = 'inasistencias_seguidas'`);
  q(`delete from "PausaDelCiclo" where "cicloId" = '${CICLO}'`);
  q(`delete from "Ciclo" where id = '${CICLO}'`);
  q(`insert into "Ciclo" (id, anio, activo, bloqueado) values ('${CICLO}', 2092, false, false)`);
  q(`insert into "Cuota" (id, "alumnoId", mes, anio, "montoBase", descuento, "montoFinal", vencimiento, estado) values ('${CUOTA}', '${P}-hijo1', 3, 2091, 1000, 0, 1000, '2091-03-10', 'pendiente')`);
  q(`insert into "Cuota" (id, "alumnoId", mes, anio, "montoBase", descuento, "montoFinal", vencimiento, estado) values ('${CUOTA2}', '${P}-hijo1', 4, 2091, 1000, 0, 1000, '2091-04-10', 'pendiente')`);
  const b = await chromium.launch({ executablePath: "/usr/bin/google-chrome" });
  const admin = await b.newPage({ viewport: { width: 1280, height: 1400 } });
  const secre = await b.newPage({ viewport: { width: 1280, height: 1000 } });
  const modal = (p) => p.locator("div.fixed.inset-0");
  try {
    await entrar(admin, "admin");

    // 1. Modal de pausa: sin los datos completos, Enter no hace nada; completos, guarda y cierra
    await admin.goto(`${BASE}/configuracion`);
    const tarjeta = admin.getByTestId("calendario-2092");
    await tarjeta.waitFor({ timeout: 8000 });
    await tarjeta.getByRole("button", { name: "Agregar pausa" }).click();
    const nombre = modal(admin).getByPlaceholder("Ej: Día de la Independencia");
    await nombre.fill("Pruebaav enter");
    await nombre.press("Enter");
    await admin.waitForTimeout(800);
    ok("pausa: con el botón deshabilitado (falta la fecha), Enter no guarda ni cierra", `${await modal(admin).count()} ${q(`select count(*) from "PausaDelCiclo" where "cicloId"='${CICLO}'`)}`, "1 0");
    // Flechas: abajo/arriba mueven el foco entre los campos
    await nombre.press("ArrowDown");
    ok("pausa: la flecha hacia abajo pasa al campo siguiente (la fecha)", await admin.evaluate(() => document.activeElement?.getAttribute("type")), "date");
    await nombre.focus();
    await nombre.press("ArrowUp");
    ok("pausa: la flecha hacia arriba vuelve al campo anterior (el tipo)", await admin.evaluate(() => document.activeElement?.tagName), "SELECT");
    await modal(admin).locator('input[type="date"]').first().fill("2092-07-09");
    await nombre.press("Enter");
    await modal(admin).waitFor({ state: "detached", timeout: 8000 });
    ok("pausa: con todo completo, Enter guarda y cierra el modal", q(`select count(*) from "PausaDelCiclo" where "cicloId"='${CICLO}'`), "1");

    // 2. Cobro: Enter en el buscador de alumnos no cobra; Enter en la fecha, sí
    await admin.goto(`${BASE}/cuotas`);
    await admin.getByRole("button", { name: "Registrar pago" }).first().click();
    const buscador = modal(admin).getByPlaceholder("Nombre o DNI del alumno…");
    await buscador.fill("Tomasav");
    await modal(admin).getByRole("button", { name: /Tomasav/ }).first().click();
    await modal(admin).getByRole("button", { name: /Marzo 2091/ }).click();
    await buscador.press("Enter");
    await admin.waitForTimeout(1200);
    ok("cobro: Enter en el buscador de alumnos no registra el pago", `${await modal(admin).count()} ${q(`select count(*) from "Pago" where "cuotaId"='${CUOTA}'`)}`, "1 0");
    await modal(admin).locator('input[type="date"]').press("Enter");
    await modal(admin).waitFor({ state: "detached", timeout: 8000 });
    ok("cobro: Enter en la fecha, con la cuota elegida, registra el pago", q(`select count(*) from "Pago" where "cuotaId"='${CUOTA}'`), "1");

    // 2b. Con la cuota elegida y el foco en el botón de la cuota o del método, Enter confirma; las flechas mueven el foco
    await admin.goto(`${BASE}/cuotas`);
    await admin.getByRole("button", { name: "Registrar pago" }).first().click();
    await modal(admin).getByPlaceholder("Nombre o DNI del alumno…").fill("Tomasav");
    await modal(admin).getByRole("button", { name: /Tomasav/ }).first().click();
    await modal(admin).getByRole("button", { name: /Abril 2091/ }).click();
    await admin.keyboard.press("ArrowDown");
    ok("cobro: la flecha hacia abajo desde la cuota pasa al primer método de pago", (await admin.evaluate(() => document.activeElement?.textContent ?? "")).trim(), "Efectivo");
    await admin.keyboard.press("ArrowUp");
    ok("cobro: la flecha hacia arriba vuelve a la cuota", (await admin.evaluate(() => document.activeElement?.textContent ?? "")).includes("Abril 2091"), true);
    await admin.keyboard.press("Enter");
    await modal(admin).waitFor({ state: "detached", timeout: 8000 });
    ok("cobro: Enter sobre la cuota elegida registra el pago", q(`select count(*) from "Pago" where "cuotaId"='${CUOTA2}'`), "1");

    // 4. Campos sueltos de Configuración: Enter guarda
    await admin.goto(`${BASE}/configuracion`);
    await admin.locator("#dia-vencimiento").waitFor({ timeout: 8000 });
    await admin.locator("#dia-vencimiento").fill("29");
    await admin.locator("#dia-vencimiento").press("Enter");
    await admin.waitForTimeout(800);
    ok("vencimiento: un día inválido (29) con el botón deshabilitado, Enter no guarda", q(`select "diaVencimiento" from "Configuracion" limit 1`), diaOriginal);
    await admin.locator("#dia-vencimiento").fill("7");
    await admin.locator("#dia-vencimiento").press("Enter");
    await admin.waitForFunction(() => document.body.innerText.includes("vence el día 7"), null, { timeout: 8000 });
    ok("vencimiento: Enter guarda el día", q(`select "diaVencimiento" from "Configuracion" limit 1`), "7");

    const tarjetaCiclo = admin.getByTestId("calendario-2092");
    await tarjetaCiclo.getByLabel("Inicio de clases 2092").fill("2092-03-16");
    await tarjetaCiclo.getByLabel("Fin de clases 2092").fill("2092-11-27");
    await tarjetaCiclo.getByLabel("Fin de clases 2092").press("Enter");
    await admin.waitForFunction(() => document.querySelector('[data-testid="calendario-2092"] button[type="submit"]')?.hasAttribute("disabled"), null, { timeout: 8000 });
    ok("fechas del ciclo: Enter guarda inicio y fin", q(`select to_char(inicio,'YYYY-MM-DD') || ' ' || to_char(fin,'YYYY-MM-DD') from "Ciclo" where id='${CICLO}'`), "2092-03-16 2092-11-27");

    const umbral = admin.locator("#umbral-inasistencias_seguidas");
    await umbral.fill("4");
    await umbral.press("Enter");
    await admin.waitForTimeout(1500);
    ok("automatización: Enter guarda el número de la regla", q(`select umbral from "Automatizacion" where regla='inasistencias_seguidas'`), "4");

    await admin.getByLabel("Nuevo ciclo (año)").fill("2091");
    await admin.getByLabel("Nuevo ciclo (año)").press("Enter");
    await admin.waitForTimeout(1500);
    ok("ciclo nuevo: Enter crea el ciclo", q(`select count(*) from "Ciclo" where anio = 2091`), "1");

    // 3. Área de texto: Enter es un salto de línea y no envía
    await entrar(secre, "secre");
    await secre.goto(`${BASE}/alumnos/${P}-hijo1`);
    await secre.click("button:has-text('Observaciones')");
    await secre.click("button:has-text('Nueva observación')");
    const area = modal(secre).locator("textarea");
    await area.fill("Primera línea");
    const antes = q(`select count(*) from "Observacion" where "alumnoId"='${P}-hijo1'`);
    await area.press("Enter");
    await area.pressSequentially("segunda línea");
    await secre.waitForTimeout(800);
    ok("observación: Enter en el área de texto hace un salto de línea", (await area.inputValue()).includes("\n"), true);
    ok("y no envía la observación", `${await modal(secre).count()} ${q(`select count(*) from "Observacion" where "alumnoId"='${P}-hijo1'`) === antes}`, "1 true");
  } finally {
    await b.close();
    q(`delete from "Pago" where "cuotaId" in ('${CUOTA}', '${CUOTA2}')`);
    q(`delete from "Cuota" where id in ('${CUOTA}', '${CUOTA2}')`);
    q(`delete from "PausaDelCiclo" where "cicloId" = '${CICLO}'`);
    q(`delete from "Ciclo" where id = '${CICLO}'`);
    q(`delete from "Ciclo" where anio = 2091 and id not like 'prueba-%' and activo = false`);
    q(`update "Configuracion" set "diaVencimiento" = ${diaOriginal}`);
    // Cambiar el número de una regla cierra y reabre alertas de verdad: se deshace lo que abrió o cerró sobre alumnos reales.
    q(`update "Automatizacion" set umbral = ${umbralOriginal} where regla = 'inasistencias_seguidas'`);
    q(`delete from "AlertaAutomatica" where "abiertaEn" >= '${inicioDePrueba}'`);
    q(`update "AlertaAutomatica" set "resueltaEn" = null, "motivoCierre" = null where "resueltaEn" >= '${inicioDePrueba}'`);
  }
})().catch((e) => { console.log(`sin excepciones: ${e.message.split("\n").slice(0, 4).join(" | ")} (esperado ninguna)`); process.exit(1); });
