// 3d, Tarea 13: el panel del responsable según sus cursadas (familia, adulto solo, adulto con hijo, sin alumnos) y
// que nadie vea lo de otra cuenta.
const { chromium } = require("playwright");
const { execSync } = require("child_process");
const ok = (e, r, x) => console.log(`${e}: ${r} (esperado ${x})`);
const BASE = "http://localhost:5173";
const q = (sql) => execSync(`docker exec babylon-postgres psql -U babylon -d babylon -tAc "${sql.replace(/(["$`\\])/g, "\\$1")}"`).toString().trim();
const P = "prueba-tmp-av";
const mail = (x) => `${P}-${x}@prueba.babylon.test`;

(async () => {
  const hash = q(`select "passwordHash" from "Usuario" where id='${P}-padre'`);
  const cuenta = (id) => q(`insert into "Usuario" (id, nombre, email, "passwordHash", roles, estado, "fechaCreacion") values ('${P}-${id}','Pruebaav ${id}','${mail(id)}','${hash}','{padre}','activo', now())`);
  // Un adulto solo: su ficha y su alumno "propio".
  cuenta("adulto");
  q(`insert into "Padre" (id, nombre, apellido, dni, telefono, "usuarioId") values ('${P}-adulto-ficha','Pruebaav','Adulto','99400301','+5493515550001','${P}-adulto')`);
  q(`insert into "Alumno" (id, nombre, apellido, dni, "fechaNacimiento", "fechaInscripcion", estado, "padreId", "vinculoResponsable", "cursoId", "aplicaDescuentoHermanos") values ('${P}-adulto-alumno','Pruebaav','Adulto','99400301','1990-01-01', now(), 'activo','${P}-adulto-ficha','propio','${P}-curso', false)`);
  q(`insert into "Inscripcion" (id, "alumnoId", "cursoId", "cicloId", fecha, "aplicaDescuentoHermanos") select '${P}-adulto-insc','${P}-adulto-alumno','${P}-curso', id, now(), false from "Ciclo" where activo`);
  // Una mamá que también estudia: la ficha de la cuenta "ajeno" suma su propia cursada.
  q(`insert into "Alumno" (id, nombre, apellido, dni, "fechaNacimiento", "fechaInscripcion", estado, "padreId", "vinculoResponsable", "cursoId", "aplicaDescuentoHermanos") values ('${P}-mama-alumno','Mamaav','Estudia','99400302','1985-01-01', now(), 'activo','${P}-ajeno','propio','${P}-curso-multi', false)`);
  // Un responsable todavía sin alumnos.
  cuenta("vacio");
  q(`insert into "Padre" (id, nombre, apellido, telefono, "usuarioId") values ('${P}-vacio-ficha','Pruebaav','Vacio','+5493515550002','${P}-vacio')`);

  const b = await chromium.launch({ executablePath: "/usr/bin/google-chrome" });
  const abrir = async (quien) => {
    const p = await (await b.newContext({ viewport: { width: 1280, height: 1000 } })).newPage();
    await p.goto(`${BASE}/login`);
    await p.fill('input[name="email"]', mail(quien));
    await p.fill('input[name="password"]', "prueba1234");
    await p.click('button[type="submit"]');
    await p.waitForURL((u) => !u.pathname.startsWith("/login"));
    await p.waitForTimeout(800);
    return p;
  };
  const menu = async (p) => (await p.locator("aside, nav").first().textContent()) ?? "";
  try {
    // 1. Familia con hijos: los textos de siempre y el selector con los nombres
    let p = await abrir("padre");
    const m1 = await menu(p);
    ok("familia: el menú de siempre", m1.includes("Resumen") && m1.includes("Mensajes") && !m1.includes("Mi cursada"), true);
    const etiquetas = (await p.locator("button[aria-pressed]").allTextContents()).map((x) => x.replace(/^[A-Z]{1,2}(?=[A-Z][a-z])/, ""));
    ok("familia: selector con los dos hijos", `${etiquetas.length} ${[...etiquetas].sort().join(",")}`, "2 Lunaav,Tomasav");
    // Privacidad: una cursada ajena en la dirección no se abre
    await p.goto(`${BASE}/mis-hijos?hijo=${P}-alumno-ajeno`);
    await p.waitForTimeout(800);
    ok("privacidad: pedir un alumno ajeno muestra uno propio", (await p.textContent("h2")).includes("Ajenoav"), false);

    // 2. Adulto solo: en primera persona, sin selector, puede autorizar su imagen
    p = await abrir("adulto");
    const m2 = await menu(p);
    ok("adulto solo: menú en primera persona", ["Mi cursada", "Mis notas", "Mi asistencia", "Mis cuotas", "Mi documentación", "Chat con el instituto"].every((t) => m2.includes(t)), true);
    ok("adulto solo: sin selector", await p.locator("button[aria-pressed]").count(), 0);
    ok("adulto solo: el encabezado dice Mi cursada", await p.locator("h2").first().textContent(), "Mi cursada");
    await p.goto(`${BASE}/mis-hijos/documentacion`);
    await p.waitForTimeout(800);
    await p.locator("label button").first().click();
    await p.getByRole("button", { name: "Autorizar", exact: true }).click();
    await p.waitForTimeout(1200);
    ok("adulto solo: autoriza su propia imagen", q(`select estado from "Documento" where "alumnoId"='${P}-adulto-alumno' and tipo='autorizacion_imagen'`), "autorizado");
    ok("adulto solo: no ve nada de otros", (await p.textContent("body")).includes("Tomasav"), false);

    // 3. Una mamá que estudia: "Yo" y su hijo, con el menú de varias cursadas
    p = await abrir("ajeno");
    const m3 = await menu(p);
    ok("mamá que estudia: menú de cursadas", m3.includes("Cursadas") && m3.includes("Calificaciones"), true);
    ok("mamá que estudia: selector con Yo y su hijo", (await p.locator("button[aria-pressed]").allTextContents()).map((x) => x.replace(/^[A-Z]{1,2}(?=[A-Z][a-z])/, "")).sort().join(","), "Ajenoav,Yo");

    // 4. Un responsable sin alumnos todavía
    p = await abrir("vacio");
    ok("sin alumnos: mensaje claro y sin errores", (await p.textContent("body")).includes("No hay alumnos asociados a tu cuenta."), true);
    ok("sin alumnos: el menú es el de siempre", (await menu(p)).includes("Resumen"), true);
  } finally {
    await b.close();
  }
})();
