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
    const fila = () => p.locator("div.rounded-md.border", { hasText: "2098" });
    await fila().getByRole("button", { name: "Bloquear" }).click();
    await p.getByRole("button", { name: "Bloquear", exact: true }).last().click();
    await fila().getByText("Bloqueado").waitFor({ timeout: 8000 });
    ok("el ciclo 2098 muestra la etiqueta Bloqueado", await fila().getByText("Bloqueado").count(), 1);
    ok("queda bloqueado en la base", q(`select bloqueado from "Ciclo" where id='${P}-ciclo-2098'`), "t");

    // Un profesor no puede guardar asistencia en un curso del ciclo bloqueado
    const profe = await token("profe");
    const hoy = new Date().toISOString().slice(0, 10);
    const r = await api("POST", "/api/asistencia/masiva", profe, { cursoId: `${P}-c1`, fecha: hoy, registros: [{ alumnoId: `${P}-e1`, estado: "presente" }] });
    ok("el profesor recibe 409 con el motivo", `${r.status} ${r.texto.includes("bloqueado")}`, "409 true");

    // Desbloquear
    await fila().getByRole("button", { name: "Desbloquear" }).click();
    await p.getByRole("button", { name: "Desbloquear", exact: true }).last().click();
    await fila().getByRole("button", { name: "Bloquear" }).waitFor({ timeout: 8000 });
    ok("se desbloqueó", q(`select bloqueado from "Ciclo" where id='${P}-ciclo-2098'`), "f");

    // El aviso de fin de año lleva al asistente
    q(`insert into "Notificacion" (id, "usuarioId", rol, tipo, clase, clave, tono, texto, recurso, nivel, "creadaEn", "actualizadaEn") values ('${P}-aviso', '${P}-admin', 'admin', 'ciclo_por_cerrar', 'estado', 'ciclo-por-cerrar:${P}', 'warning', 'El ciclo 2098 terminó. Falta pasar de año: pasá a los alumnos y activá el ciclo nuevo.', '{"tipo":"pase-de-anio"}', 0, now(), now())`);
    await p.reload();
    await p.getByRole("button", { name: /Notificaciones/ }).click();
    await p.getByText("Falta pasar de año", { exact: false }).first().click();
    await p.waitForURL((u) => u.pathname === "/ciclos/pasar-de-anio", { timeout: 8000 });
    ok("el aviso lleva a la pantalla del asistente", new URL(p.url()).pathname, "/ciclos/pasar-de-anio");

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
  } finally {
    await b.close();
  }
})().catch((e) => { console.log(`sin excepciones: ${e.message.split("\n")[0]} (esperado ninguna)`); process.exit(1); });
