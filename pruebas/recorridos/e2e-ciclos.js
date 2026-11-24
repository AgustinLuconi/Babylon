// Ciclos: el administrador bloquea y desbloquea un ciclo (con su etiqueta), un profesor no puede guardar en un curso de un
// ciclo bloqueado, el asistente "Pasar de año" se completa de punta a punta (sin tocar el ciclo activo real) y el aviso de
// fin de año de la campana lleva a la pantalla del asistente. Usa ciclos de prueba 2098 y 2099.
const { chromium } = require("playwright");
const { execSync } = require("child_process");
const ok = (e, r, x) => console.log(`${e}: ${r} (esperado ${x})`);
const BASE = "http://localhost:5173";
const API = "http://localhost:4000";
const P = "prueba-tmp-av";
const q = (sql) => execSync(`docker exec babylon-postgres psql -U babylon -d babylon -tAc "${sql.replace(/"/g, '\\"')}"`).toString().trim();
const email = (x) => `${P}-${x}@prueba.babylon.test`;

async function token(quien) {
  const r = await fetch(`${API}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: email(quien), password: "prueba1234" }) });
  return (await r.json()).token;
}
const api = async (metodo, ruta, tk, cuerpo) => {
  const r = await fetch(`${API}${ruta}`, { method: metodo, headers: { "Content-Type": "application/json", Authorization: `Bearer ${tk}` }, body: cuerpo ? JSON.stringify(cuerpo) : undefined });
  const t = await r.text();
  return { status: r.status, texto: t, d: t ? JSON.parse(t) : null };
};

(async () => {
  // Preparación: dos ciclos de prueba, un curso en el de origen y un alumno inscripto en él.
  q(`insert into "Ciclo" (id, anio, activo, bloqueado) values ('${P}-ciclo-2098', 2098, false, false), ('${P}-ciclo-2099', 2099, false, false)`);
  q(`insert into "Curso" (id, nombre, nivel, "profesorId", "cicloId", cupo, estado) values ('${P}-c1', 'Pruebaav Uno', 'kids', '${P}-profe', '${P}-ciclo-2098', 10, 'activo')`);
  q(`insert into "Alumno" (id, nombre, apellido, "fechaInscripcion", estado, "padreId", "cursoId", "aplicaDescuentoHermanos") values ('${P}-e1', 'Pruebaave1', 'Pruebaav', now(), 'activo', '${P}-padre', '${P}-c1', false)`);
  q(`insert into "Inscripcion" (id, "alumnoId", "cursoId", "cicloId", fecha, "aplicaDescuentoHermanos") values ('${P}-e1-i', '${P}-e1', '${P}-c1', '${P}-ciclo-2098', now(), false)`);
  const activoAntes = q(`select id from "Ciclo" where activo = true`);

  const b = await chromium.launch({ executablePath: "/usr/bin/google-chrome" });
  const p = await b.newPage({ viewport: { width: 1280, height: 1200 } });
  try {
    await p.goto(`${BASE}/login`);
    await p.fill('input[name="email"]', email("admin"));
    await p.fill('input[name="password"]', "prueba1234");
    await p.click('button[type="submit"]');
    await p.waitForURL((u) => !u.pathname.startsWith("/login"));

    // Bloquear desde Configuración
    await p.goto(`${BASE}/configuracion`);
    // La fila del panel "Ciclos lectivos" (la tarjeta del calendario también menciona 2098, pero no tiene estos botones).
    const fila = () => p.locator("div.rounded-md.border", { hasText: "2098" }).filter({ has: p.getByRole("button", { name: /Bloquear|Desbloquear|Marcar como activo/ }) });
    await fila().getByRole("button", { name: "Bloquear" }).click();
    await p.getByRole("button", { name: "Bloquear", exact: true }).last().click();
    await fila().getByText("Bloqueado").waitFor({ timeout: 8000 });
    ok("el ciclo 2098 muestra la etiqueta Bloqueado", await fila().getByText("Bloqueado").count(), 1);
    ok("queda bloqueado en la base", q(`select bloqueado from "Ciclo" where id='${P}-ciclo-2098'`), "t");

    // Un profesor no puede guardar asistencia en un curso del ciclo bloqueado
    const profe = await token("profe");
    const hoy = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).format(new Date()); // día de Argentina (en UTC, de noche sería mañana)
    const r = await api("POST", "/api/asistencia/masiva", profe, { cursoId: `${P}-c1`, fecha: hoy, registros: [{ alumnoId: `${P}-e1`, estado: "presente" }] });
    ok("el profesor recibe 409 con el motivo", `${r.status} ${r.texto.includes("bloqueado")}`, "409 true");

    // Desbloquear
    await fila().getByRole("button", { name: "Desbloquear" }).click();
    await p.getByRole("button", { name: "Desbloquear", exact: true }).last().click();
    await fila().getByRole("button", { name: "Bloquear" }).waitFor({ timeout: 8000 });
    ok("se desbloqueó", q(`select bloqueado from "Ciclo" where id='${P}-ciclo-2098'`), "f");

    // El aviso de fin de año lleva al asistente
    q(`insert into "Notificacion" (id, "usuarioId", rol, tipo, clase, clave, tono, texto, recurso, nivel, "creadaEn", "actualizadaEn") values ('${P}-aviso', '${P}-admin', 'admin', 'ciclo_por_cerrar', 'estado', 'ciclo-por-cerrar:${P}', 'warning', 'El ciclo 2098 terminó. Falta pasar de año: pasá a los alumnos y activá el ciclo nuevo.', '{"tipo":"pase-de-anio","cicloId":"${P}-ciclo-2098"}', 0, now(), now())`);
    await p.reload();
    await p.getByRole("button", { name: /Notificaciones/ }).click();
    await p.getByText("Falta pasar de año", { exact: false }).first().click();
    await p.waitForURL((u) => u.pathname === "/ciclos/pasar-de-anio", { timeout: 8000 });
    ok("el aviso lleva a la pantalla del asistente", new URL(p.url()).pathname, "/ciclos/pasar-de-anio");
    // El select se llena cuando llegan los ciclos: se espera a que tenga valor en vez de leerlo en el mismo instante.
    await p.waitForFunction(() => document.querySelector("select")?.value, null, { timeout: 8000 }).catch(() => {});
    ok("y deja elegido el ciclo del aviso como origen", await p.getByLabel("De qué ciclo se pasa").inputValue(), `${P}-ciclo-2098`);

    // El asistente de punta a punta
    await p.getByLabel("De qué ciclo se pasa").selectOption({ label: "2098" });
    await p.getByLabel("Ciclo de destino").selectOption({ label: "2099" });
    await p.getByRole("button", { name: "Siguiente" }).click();
    await p.getByText("Pruebaav Uno").first().waitFor({ timeout: 8000 });
    ok("paso 2: el curso con alumnos viene marcado para copiar", await p.locator('label:has-text("Pruebaav Uno") input[type="checkbox"]').isChecked(), true);
    await p.getByRole("button", { name: "Siguiente" }).click();
    ok("paso 3: sin decisión no se puede avanzar", await p.getByRole("button", { name: "Siguiente" }).isDisabled(), true);
    await p.getByLabel("Destino de Pruebaav Uno").selectOption(`copia:${P}-c1`);
    await p.getByRole("button", { name: "Siguiente" }).click();
    await p.getByText("1 pasan, 0 egresan, 0 no continúan").waitFor({ timeout: 8000 });
    ok("paso 4: el resumen cuenta al alumno", await p.getByText("1 pasan, 0 egresan, 0 no continúan").count(), 1);
    ok("paso 4: avisa que el año del origen no terminó", await p.getByText("todavía no terminó").count(), 1);
    await p.getByRole("button", { name: "Siguiente" }).click();
    // Sin cierre: el ciclo activo real no se toca
    await p.getByLabel(/Activar el ciclo 2099/).uncheck();
    await p.getByRole("button", { name: "Confirmar el pase de año" }).click();
    await p.getByText("Pase de año hecho").waitFor({ timeout: 15000 });
    ok("el asistente terminó", await p.getByText("Pase de año hecho").count(), 1);

    ok("el alumno pasó a un curso nuevo del ciclo 2099", q(`select c."cicloId" from "Alumno" a join "Curso" c on c.id = a."cursoId" where a.id='${P}-e1'`), `${P}-ciclo-2099`);
    ok("su inscripción 2098 queda intacta", q(`select "cursoId" from "Inscripcion" where "alumnoId"='${P}-e1' and "cicloId"='${P}-ciclo-2098'`), `${P}-c1`);
    const admin = await token("admin");
    const lista = await api("GET", `/api/cursos/${P}-c1/alumnos`, admin);
    ok("el curso viejo sigue mostrando a su alumno", lista.d.map((a) => a.id).join(","), `${P}-e1`);
    ok("el ciclo activo real no cambió", q(`select id from "Ciclo" where activo = true`), activoAntes);

    // El legajo muestra el historial de cursos: el año nuevo (actual) y el anterior
    await p.goto(`${BASE}/alumnos/${P}-e1`);
    const historial = p.locator(".card-hl", { has: p.getByRole("heading", { name: "Historial de cursos" }) });
    await historial.getByText("2099").waitFor({ timeout: 8000 });
    const texto = await historial.textContent();
    ok("el legajo muestra el historial: 2099 (actual) y 2098", `${texto.includes("2099")} ${texto.includes("2098")} ${texto.includes("Actual")}`, "true true true");
    ok("el historial muestra el nombre del curso de 2098", texto.includes("Pruebaav Uno"), true);

    // Lo que le fue en cada curso: una nota de 2098 no aparece en el curso actual y sí al elegir el año anterior
    q(`insert into "Evaluacion" (id, "cursoId", nombre, tipo, fecha, periodo, estado) values ('${P}-ev-vieja', '${P}-c1', 'Pruebaav examen viejo', 'examen', '2098-05-05', 'julio', 'publicada')`);
    q(`insert into "Calificacion" (id, "evaluacionId", "alumnoId", nota) values ('${P}-nota-vieja', '${P}-ev-vieja', '${P}-e1', '9')`);
    await p.goto(`${BASE}/alumnos/${P}-e1?pestana=academico`);
    await p.getByLabel("Año").waitFor({ timeout: 8000 });
    ok("legajo: por defecto no se ve la nota del curso viejo", await p.getByText("Pruebaav examen viejo").count(), 0);
    await p.getByLabel("Año").selectOption(`${P}-c1`);
    await p.getByText("Pruebaav examen viejo").waitFor({ timeout: 8000 });
    ok("legajo: al elegir 2098 se ve su nota", await p.getByText("Pruebaav examen viejo").count(), 1);

    // Lo mismo desde el panel de la familia (cada familia solo ve a su hijo)
    const f = await b.newPage({ viewport: { width: 1280, height: 1200 } });
    await f.goto(`${BASE}/login`);
    await f.fill('input[name="email"]', email("padre"));
    await f.fill('input[name="password"]', "prueba1234");
    await f.click('button[type="submit"]');
    await f.waitForURL((u) => !u.pathname.startsWith("/login"));
    await f.goto(`${BASE}/mis-hijos/calificaciones?hijo=${P}-e1`);
    await f.getByLabel("Año").waitFor({ timeout: 8000 });
    ok("familia: por defecto no ve la nota del curso viejo", await f.getByText("Pruebaav examen viejo").count(), 0);
    await f.getByLabel("Año").selectOption(`${P}-c1`);
    await f.getByText("Pruebaav examen viejo").waitFor({ timeout: 8000 });
    ok("familia: al elegir 2098 ve su nota", await f.getByText("Pruebaav examen viejo").count(), 1);

    // El panel de la familia también muestra el historial de cursos (sin la columna de descuento) y separa las observaciones por año
    q(`insert into "Observacion" (id, "alumnoId", "emisorId", "emisorRol", fecha, texto, categoria) values ('${P}-obs-vieja', '${P}-e1', '${P}-admin', 'admin', '2098-06-01T12:00:00Z', 'Pruebaav obs vieja', 'academico'), ('${P}-obs-nueva', '${P}-e1', '${P}-admin', 'admin', '2099-06-01T12:00:00Z', 'Pruebaav obs nueva', 'academico')`);
    await f.goto(`${BASE}/mis-hijos?hijo=${P}-e1`);
    const histFamilia = f.locator(".card-hl", { has: f.getByRole("heading", { name: "Historial de cursos" }) });
    await histFamilia.getByText("2098").waitFor({ timeout: 8000 });
    const tf = await histFamilia.textContent();
    ok("familia: el historial muestra 2099 (actual) y 2098, sin descuento", `${tf.includes("2099")} ${tf.includes("2098")} ${tf.includes("Actual")} ${tf.includes("Descuento")}`, "true true true false");
    await f.getByText("Pruebaav obs nueva").waitFor({ timeout: 8000 });
    ok("familia: por defecto ve la observación del curso actual y no la vieja", `${await f.getByText("Pruebaav obs nueva").count()} ${await f.getByText("Pruebaav obs vieja").count()}`, "1 0");
    await f.getByLabel("Año").selectOption(`${P}-c1`);
    await f.getByText("Pruebaav obs vieja").waitFor({ timeout: 8000 });
    ok("familia: al elegir 2098 ve la observación de ese año", `${await f.getByText("Pruebaav obs vieja").count()} ${await f.getByText("Pruebaav obs nueva").count()}`, "1 0");

    // Y el legajo separa las observaciones por año
    await p.goto(`${BASE}/alumnos/${P}-e1?pestana=observaciones`);
    await p.getByLabel("Año").waitFor({ timeout: 8000 });
    await p.getByText("Pruebaav obs nueva").waitFor({ timeout: 8000 });
    ok("legajo: por defecto ve la observación del curso actual y no la vieja", `${await p.getByText("Pruebaav obs nueva").count()} ${await p.getByText("Pruebaav obs vieja").count()}`, "1 0");
    await p.getByLabel("Año").selectOption(`${P}-c1`);
    await p.getByText("Pruebaav obs vieja").waitFor({ timeout: 8000 });
    ok("legajo: al elegir 2098 ve la observación de ese año", `${await p.getByText("Pruebaav obs vieja").count()} ${await p.getByText("Pruebaav obs nueva").count()}`, "1 0");
  } finally {
    await b.close();
  }
})().catch((e) => { console.log(`sin excepciones: ${e.message.split("\n")[0]} (esperado ninguna)`); process.exit(1); });
