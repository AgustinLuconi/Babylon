// Calendario del ciclo: el administrador carga fechas y pausas de un ciclo de prueba (2093), ve los errores de la
// pantalla, edita y borra pausas, cambia el día de vencimiento de la cuota; el profesor ve el aviso de "no hay clases"
// (con el guardado deshabilitado) en una pausa y fuera del ciclo del ciclo activo.
const { chromium } = require("playwright");
const { execSync } = require("child_process");
const ok = (e, r, x) => console.log(`${e}: ${r} (esperado ${x})`);
const BASE = "http://localhost:5173";
const P = "prueba-tmp-av";
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
  const CICLO = `${P}-ciclo-cal`;
  const diaOriginal = q(`select "diaVencimiento" from "Configuracion" limit 1`);
  q(`delete from "PausaDelCiclo" where "cicloId" = '${CICLO}'`);
  q(`delete from "Ciclo" where id = '${CICLO}'`);
  q(`insert into "Ciclo" (id, anio, activo, bloqueado) values ('${CICLO}', 2093, false, false)`);
  const b = await chromium.launch({ executablePath: "/usr/bin/google-chrome" });
  const admin = await b.newPage({ viewport: { width: 1280, height: 1400 } });
  const profe = await b.newPage({ viewport: { width: 1280, height: 1100 } });
  try {
    await entrar(admin, "admin");
    await admin.goto(`${BASE}/configuracion`);
    const tarjeta = admin.getByTestId("calendario-2093");
    const modal = admin.locator("div.fixed.inset-0");
    await tarjeta.waitFor({ timeout: 8000 });
    ok("el apartado muestra el ciclo con el calendario por defecto", `${await tarjeta.getByLabel("Inicio de clases 2093").inputValue()} ${await tarjeta.getByLabel("Fin de clases 2093").inputValue()}`, "2093-03-01 2093-11-30");

    // Pausas: alta de un feriado
    await tarjeta.getByRole("button", { name: "Agregar pausa" }).click();
    await modal.getByPlaceholder("Ej: Día de la Independencia").fill("Pruebaav feriado");
    await modal.locator('input[type="date"]').first().fill("2093-07-09");
    await modal.getByRole("button", { name: "Guardar", exact: true }).click();
    await tarjeta.getByText("Pruebaav feriado").waitFor({ timeout: 8000 });
    ok("el feriado se guarda y se lista con un solo día", await tarjeta.getByText("Feriado · 09/07/2093").count(), 1);

    // Un receso que se superpone: la pantalla avisa y no deja guardar
    await tarjeta.getByRole("button", { name: "Agregar pausa" }).click();
    await modal.locator("select").selectOption("receso");
    await modal.getByPlaceholder("Ej: Receso de invierno").fill("Pruebaav receso");
    const fechas = modal.locator('input[type="date"]');
    await fechas.nth(0).fill("2093-07-09");
    await fechas.nth(1).fill("2093-07-12");
    await admin.getByText('La pausa se superpone con "Pruebaav feriado"').waitFor({ timeout: 5000 });
    ok("superpuesta: guardar deshabilitado", await modal.getByRole("button", { name: "Guardar", exact: true }).isDisabled(), true);
    await fechas.nth(0).fill("2093-07-20");
    await fechas.nth(1).fill("2093-07-31");
    await modal.getByRole("button", { name: "Guardar", exact: true }).click();
    await tarjeta.getByText("Pruebaav receso").waitFor({ timeout: 8000 });
    ok("el receso se guarda con su rango", await tarjeta.getByText("Receso de invierno · 20/07/2093 al 31/07/2093").count(), 1);

    // Editar y borrar
    await tarjeta.getByRole("button", { name: "Editar Pruebaav feriado" }).click();
    await modal.getByPlaceholder("Ej: Día de la Independencia").fill("Pruebaav feriado editado");
    await modal.getByRole("button", { name: "Guardar", exact: true }).click();
    await tarjeta.getByText("Pruebaav feriado editado").waitFor({ timeout: 8000 });
    ok("la pausa editada cambia de nombre", q(`select nombre from "PausaDelCiclo" where "cicloId"='${CICLO}' and nombre like '%editado'`), "Pruebaav feriado editado");
    await tarjeta.getByRole("button", { name: "Borrar Pruebaav receso" }).click();
    await modal.getByRole("button", { name: "Borrar", exact: true }).click();
    await tarjeta.getByText("Pruebaav receso", { exact: true }).waitFor({ state: "detached", timeout: 8000 });
    ok("la pausa borrada ya no está en la base", q(`select count(*) from "PausaDelCiclo" where "cicloId"='${CICLO}'`), "1");

    // Fechas del ciclo: una pausa que queda afuera se rechaza; fechas válidas se guardan y sobreviven a recargar
    await tarjeta.getByLabel("Inicio de clases 2093").fill("2093-08-01");
    await admin.getByText('La pausa "Pruebaav feriado editado" quedaría fuera del ciclo').waitFor({ timeout: 5000 });
    ok("fechas que dejan una pausa afuera: guardar deshabilitado", await tarjeta.getByRole("button", { name: "Guardar fechas" }).isDisabled(), true);
    await tarjeta.getByLabel("Inicio de clases 2093").fill("2093-03-16");
    await tarjeta.getByLabel("Fin de clases 2093").fill("2093-11-27");
    await tarjeta.getByRole("button", { name: "Guardar fechas" }).click();
    await admin.waitForFunction(() => document.querySelector('[data-testid="calendario-2093"] button') !== null);
    await admin.reload();
    await tarjeta.waitFor({ timeout: 8000 });
    ok("las fechas guardadas sobreviven a recargar", `${await tarjeta.getByLabel("Inicio de clases 2093").inputValue()} ${await tarjeta.getByLabel("Fin de clases 2093").inputValue()}`, "2093-03-16 2093-11-27");

    // Fechas: sin una fecha no se puede guardar; volver al valor guardado deja de contar como cambio
    await tarjeta.getByLabel("Inicio de clases 2093").fill("");
    ok("con una fecha borrada, guardar fechas deshabilitado", await tarjeta.getByRole("button", { name: "Guardar fechas" }).isDisabled(), true);
    await tarjeta.getByLabel("Inicio de clases 2093").fill("2093-04-01");
    ok("con un cambio válido, guardar fechas habilitado", await tarjeta.getByRole("button", { name: "Guardar fechas" }).isDisabled(), false);
    await tarjeta.getByLabel("Inicio de clases 2093").fill("2093-03-16");
    ok("volver al valor guardado: sin cambios, guardar fechas deshabilitado", await tarjeta.getByRole("button", { name: "Guardar fechas" }).isDisabled(), true);

    // Día de vencimiento
    await admin.locator("#dia-vencimiento").fill("7");
    await admin.getByRole("button", { name: "Guardar", exact: true }).first().click();
    await admin.waitForFunction(() => document.body.innerText.includes("vence el día 7"), null, { timeout: 8000 });
    ok("el día de vencimiento se guarda", q(`select "diaVencimiento" from "Configuracion" limit 1`), "7");
    await admin.reload();
    await admin.locator("#dia-vencimiento").waitFor({ timeout: 8000 });
    await admin.waitForFunction(() => document.querySelector("#dia-vencimiento").value === "7", null, { timeout: 8000 });
    ok("al recargar el campo muestra 7", await admin.locator("#dia-vencimiento").inputValue(), "7");
    await admin.locator("#dia-vencimiento").fill("29");
    ok("un día fuera de 1 a 28 no se puede guardar", await admin.getByRole("button", { name: "Guardar", exact: true }).first().isDisabled(), true);

    // El profesor, en una pausa del ciclo activo y fuera del ciclo
    await entrar(profe, "profe");
    const pausaDia = dia(2);
    q(`insert into "PausaDelCiclo" (id, "cicloId", desde, hasta, nombre, tipo) select '${P}-pausa-e2e', id, '${pausaDia}', '${pausaDia}', 'Pruebaav pausa activa', 'feriado' from "Ciclo" where activo`);
    await profe.goto(`${BASE}/asistencia?curso=${P}-curso&fecha=${pausaDia}`);
    await profe.getByText("Ese día no hay clases: Pruebaav pausa activa").waitFor({ timeout: 8000 });
    ok("el profesor ve el aviso de la pausa", await profe.getByText("Ese día no hay clases: Pruebaav pausa activa").count(), 1);
    ok("y no puede guardar", await profe.getByRole("button", { name: /Guardar/ }).first().isDisabled(), true);
    await profe.goto(`${BASE}/asistencia?curso=${P}-curso&fecha=2026-01-20`);
    await profe.getByText("Ese día no hay clases: Fuera del ciclo lectivo").waitFor({ timeout: 8000 });
    ok("fuera del ciclo también avisa", await profe.getByText("Ese día no hay clases: Fuera del ciclo lectivo").count(), 1);
    await profe.goto(`${BASE}/asistencia?curso=${P}-curso&fecha=${dia(3)}`);
    await profe.getByText(/Tomar asistencia|Cargar asistencia atrasada/).first().waitFor({ timeout: 8000 });
    ok("un día con clases no muestra el aviso", await profe.getByText(/Ese día no hay clases/).count(), 0);
  } finally {
    await b.close();
    q(`delete from "PausaDelCiclo" where "cicloId" = '${CICLO}' or id = '${P}-pausa-e2e'`);
    q(`delete from "Ciclo" where id = '${CICLO}'`);
    q(`update "Configuracion" set "diaVencimiento" = ${diaOriginal}`);
  }
})().catch((e) => { console.log(`sin excepciones: ${e.message.split("\n").slice(0,4).join(" | ")} (esperado ninguna)`); process.exit(1); });
