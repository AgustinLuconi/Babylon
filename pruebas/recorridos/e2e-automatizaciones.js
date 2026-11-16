// Automatizaciones: el profesor marca tres ausencias seguidas y llegan los avisos (administración y el profesor del curso);
// justificar una ausencia exige el motivo y corta la racha; con dos cuotas vencidas llega el aviso de deuda; el panel de
// Configuración cuenta los alumnos en alerta, cambiar el número cierra la alerta y el historial lo muestra.
const { chromium } = require("playwright");
const { execSync } = require("child_process");
const ok = (e, r, x) => console.log(`${e}: ${r} (esperado ${x})`);
const BASE = "http://localhost:5173";
const API = "http://localhost:4000";
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
async function token(quien) {
  const r = await fetch(`${API}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: email(quien), password: "prueba1234" }) });
  return (await r.json()).token;
}
const abiertas = (regla, alumno) => Number(q(`select count(*) from "AlertaAutomatica" where regla='${regla}' and "alumnoId"='${P}-${alumno}' and "resueltaEn" is null`));

(async () => {
  const inicio = q("select now()");
  q(`insert into "Automatizacion" (regla, activa, umbral) values ('deuda_cuotas', true, 2), ('inasistencias_seguidas', true, 3) on conflict (regla) do update set activa = true, umbral = excluded.umbral`);
  const b = await chromium.launch({ executablePath: "/usr/bin/google-chrome" });
  const admin = await b.newPage({ viewport: { width: 1280, height: 1100 } });
  const profe = await b.newPage({ viewport: { width: 1280, height: 1100 } });
  const adminToken = await token("admin");
  try {
    await entrar(profe, "profe");
    await entrar(admin, "admin");

    // 1. Tres ausencias seguidas de Tomasav (Lunaav presente)
    const guardarDia = async (fecha) => {
      await profe.goto(`${BASE}/asistencia?curso=${P}-curso&fecha=${fecha}`);
      const tarjeta = (alumno) => profe.locator(`xpath=(//div[contains(., "${alumno}")][.//button[normalize-space()="Ausente"]])[last()]`);
      await tarjeta("Tomasav").getByRole("button", { name: "Ausente" }).click();
      await tarjeta("Lunaav").getByRole("button", { name: "Presente" }).click();
      await profe.getByRole("button", { name: /Guardar asistencia/ }).click();
      await profe.getByText("Asistencia guardada").waitFor({ timeout: 8000 });
    };
    for (const atras of [3, 2, 1]) await guardarDia(dia(atras));
    ok("la alerta de inasistencias queda abierta con nivel 3", q(`select nivel from "AlertaAutomatica" where regla='inasistencias_seguidas' and "alumnoId"='${P}-hijo1' and "resueltaEn" is null`), "3");

    // 2. Administración ve el aviso y lo lleva al legajo
    await admin.goto(`${BASE}/notificaciones`);
    const textoAviso = "Tomasav Pruebaav tiene 3 inasistencias seguidas en Pruebaav Kids";
    await admin.getByText(textoAviso).first().waitFor({ timeout: 8000 });
    ok("administración: aviso de inasistencias seguidas", await admin.getByText(textoAviso).count(), 1);
    await admin.getByText(textoAviso).first().click();
    await admin.waitForURL((u) => u.pathname === `/alumnos/${P}-hijo1`, { timeout: 8000 });
    ok("el aviso lleva al legajo del alumno", new URL(admin.url()).pathname, `/alumnos/${P}-hijo1`);

    // 3. El profesor del curso también lo recibe y lo lleva a su asistencia
    await profe.goto(`${BASE}/notificaciones`);
    await profe.getByText(textoAviso).first().waitFor({ timeout: 8000 });
    await profe.getByText(textoAviso).first().click();
    await profe.waitForURL((u) => u.pathname === "/asistencia", { timeout: 8000 });
    const destino = new URL(profe.url());
    ok("el aviso del profesor lleva a la asistencia de su curso en la fecha de la última falta", `${destino.searchParams.get("curso")} ${destino.searchParams.get("fecha")}`, `${P}-curso ${dia(1)}`);

    // 4. Justificar la última ausencia exige el motivo, y corta la racha
    await profe.goto(`${BASE}/asistencia?curso=${P}-curso&fecha=${dia(1)}`);
    await profe.getByLabel("Justificada").check();
    ok("justificada sin motivo: no se puede guardar", await profe.getByRole("button", { name: /Guardar asistencia/ }).isDisabled(), true);
    ok("justificada sin motivo: lo dice", await profe.getByText("Escribí el motivo para justificar la ausencia").count(), 1);
    await profe.getByPlaceholder(/Motivo de la ausencia/).fill("Turno médico");
    await profe.getByRole("button", { name: /Guardar asistencia/ }).click();
    await profe.getByText("Asistencia guardada").waitFor({ timeout: 8000 });
    ok("la justificada corta la racha: la alerta se resuelve", `${abiertas("inasistencias_seguidas", "hijo1")} ${q(`select "motivoCierre" from "AlertaAutomatica" where regla='inasistencias_seguidas' and "alumnoId"='${P}-hijo1' order by "abiertaEn" desc limit 1`)}`, "0 resuelta");
    await admin.goto(`${BASE}/alumnos/${P}-hijo1?pestana=asistencia`);
    await admin.locator('[title="Ausente (justificada)"]').first().waitFor({ timeout: 8000 });
    ok("el calendario del legajo muestra la ausencia justificada", await admin.locator('[title="Ausente (justificada)"]').count(), 1);

    // La familia ve la ausencia justificada como tal en su lista de asistencia (no solo en el calendario)
    const familia = await b.newPage({ viewport: { width: 1280, height: 1100 } });
    await entrar(familia, "padre");
    await familia.goto(`${BASE}/mis-hijos/asistencia?hijo=${P}-hijo1`);
    await familia.getByText("Ausente (justificada)").first().waitFor({ timeout: 8000 });
    ok("la familia ve 'Ausente (justificada)' en su lista de asistencia", await familia.getByText("Ausente (justificada)").count() > 0, true);

    // 5. Deuda: dos cuotas vencidas de Lunaav (se revisa al guardar la regla, como lo haría cualquier cambio de cuotas)
    for (const mes of [1, 2]) q(`insert into "Cuota" (id, "alumnoId", mes, anio, "montoBase", descuento, "montoFinal", vencimiento, estado) values ('${P}-q${mes}', '${P}-hijo2', ${mes}, 2080, 1000, 0, 1000, '2080-03-10', 'vencida')`);
    await fetch(`${API}/api/automatizaciones/deuda_cuotas`, { method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` }, body: JSON.stringify({ umbral: 2 }) });
    await admin.goto(`${BASE}/notificaciones`);
    await admin.getByText("Lunaav Pruebaav debe 2 cuotas vencidas").first().waitFor({ timeout: 8000 });
    ok("administración: aviso de deuda", await admin.getByText("Lunaav Pruebaav debe 2 cuotas vencidas").count(), 1);

    // 6. Panel de Configuración
    await admin.goto(`${BASE}/configuracion`);
    const tarjeta = admin.locator('[data-regla="deuda_cuotas"]');
    await tarjeta.waitFor({ timeout: 8000 });
    const enAlerta = async () => Number((await tarjeta.locator("strong").first().textContent()).trim());
    const antes = await enAlerta();
    ok("el panel cuenta a los alumnos en alerta (al menos Lunaav)", antes >= 1, true);
    await tarjeta.getByLabel(/Número/).fill("3");
    await tarjeta.getByRole("button", { name: "Guardar" }).click();
    await admin.waitForFunction(({ antes }) => Number(document.querySelector('[data-regla="deuda_cuotas"] strong').textContent.trim()) < antes, { antes }, { timeout: 8000 });
    ok("al subir el número a 3, Lunaav sale de la alerta", (await enAlerta()) < antes, true);
    await tarjeta.getByRole("button", { name: "Ver historial" }).click();
    await tarjeta.getByText("Cambio de número").first().waitFor({ timeout: 8000 });
    ok("el historial muestra la alerta cerrada por cambio de número", `${await tarjeta.getByText("Lunaav Pruebaav").count() > 0} ${await tarjeta.getByText("Cambio de número").count() > 0}`, "true true");
    ok("la otra regla tiene su tarjeta", await admin.locator('[data-regla="inasistencias_seguidas"]').count(), 1);
    ok("secretaría no ve el panel", (await fetch(`${API}/api/automatizaciones`, { headers: { Authorization: `Bearer ${await token("secre")}` } })).status, 403);
  } finally {
    await b.close();
    // Se deshace lo que la prueba abrió o cerró sobre alumnos reales y se vuelve a dejar la regla en su número.
    q(`delete from "AlertaAutomatica" where "abiertaEn" >= '${inicio}'`);
    q(`update "AlertaAutomatica" set "resueltaEn" = null, "motivoCierre" = null where "resueltaEn" >= '${inicio}'`);
    q(`insert into "Automatizacion" (regla, activa, umbral) values ('deuda_cuotas', true, 2), ('inasistencias_seguidas', true, 3) on conflict (regla) do update set activa = true, umbral = excluded.umbral`);
  }
})().catch((e) => { console.log(`sin excepciones: ${e.message.split("\n")[0]} (esperado ninguna)`); process.exit(1); });
