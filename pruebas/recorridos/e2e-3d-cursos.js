// 3d, Tarea 11: curso, profesor, configuración y chat con el mismo criterio (solo lo que cambió, aviso de cambios ajenos,
// validación solo de lo modificado, topes de largo). Deja Configuracion.valorCuota en null al terminar.
const { chromium } = require("playwright");
const { execSync } = require("child_process");
const ok = (e, r, x) => console.log(`${e}: ${r} (esperado ${x})`);
const BASE = "http://localhost:5173";
const API = "http://localhost:4000";
const q = (sql) => execSync(`docker exec babylon-postgres psql -U babylon -d babylon -tAc "${sql.replace(/"/g, '\\"')}"`).toString().trim();
const email = (x) => `prueba-tmp-av-${x}@prueba.babylon.test`;
const P = "prueba-tmp-av";

async function token(quien, rolElegido) {
  const r = await fetch(`${API}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: email(quien), password: "prueba1234", ...(rolElegido ? { rolElegido } : {}) }) });
  return (await r.json()).token;
}
const patch = async (tk, ruta, cuerpo) => fetch(`${API}${ruta}`, { method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${tk}` }, body: JSON.stringify(cuerpo) });

(async () => {
  const b = await chromium.launch({ executablePath: "/usr/bin/google-chrome" });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 1100 } });
  const p = await ctx.newPage();
  const patches = [];
  p.on("request", (r) => { if (r.method() === "PATCH") patches.push({ url: r.url(), body: r.postData() }); });
  const login = async (page, quien) => {
    await page.goto(`${BASE}/login`);
    await page.fill('input[name="email"]', email(quien));
    await page.fill('input[name="password"]', "prueba1234");
    await page.click('button[type="submit"]');
    await page.waitForURL((u) => !u.pathname.startsWith("/login"));
  };
  const editarCurso = async (nombre) => {
    await p.goto(`${BASE}/cursos-todos`);
    await p.getByPlaceholder("Buscar curso o profesor…").fill(nombre);
    await p.locator("tr", { hasText: nombre }).getByTitle("Editar").first().click();
    await p.getByText("Editar curso").first().waitFor();
  };
  const guardarCurso = async () => { patches.length = 0; await p.getByRole("button", { name: "Guardar cambios" }).click(); await p.waitForTimeout(900); };
  try {
    await login(p, "admin");
    const admin2 = await token("multi", "admin");

    // 1. Curso: editar solo el cupo
    await editarCurso("Pruebaav Kids");
    await p.fill('input[type="number"]', "25");
    await guardarCurso();
    ok("curso: el PATCH lleva solo el cupo", patches.map((x) => x.body).join("|"), '{"cupo":25}');
    ok("curso: cupo guardado", q(`select cupo from "Curso" where id='${P}-curso'`), 25);

    // 2. Curso con un cupo viejo fuera de rango: editar otro campo no se bloquea
    q(`update "Curso" set cupo=55 where id='${P}-curso'`);
    await editarCurso("Pruebaav Kids");
    await p.getByPlaceholder("Aula 1").fill("Aula X");
    await guardarCurso();
    ok("curso con cupo viejo inválido: el PATCH lleva solo el aula", patches.map((x) => x.body).join("|"), '{"aula":"Aula X"}');
    ok("curso con cupo viejo inválido: el cupo viejo no se toca", q(`select cupo from "Curso" where id='${P}-curso'`), 55);

    // 3. Validación de lo que se modifica
    q(`update "Curso" set cupo=20 where id='${P}-curso'`);
    await editarCurso("Pruebaav Kids");
    await p.fill('input[type="number"]', "51");
    await guardarCurso();
    ok("curso: cupo 51 muestra el error", (await p.textContent("body")).includes("El cupo máximo es 50"), true);
    ok("curso: cupo 51 no manda nada", patches.length, 0);
    await p.fill('input[type="number"]', "20");
    await p.locator('input[type="time"]').nth(1).fill("09:00");
    await guardarCurso();
    ok("curso: un horario que termina antes de empezar muestra el error", (await p.textContent("body")).includes("La hora de fin tiene que ser posterior a la de inicio"), true);

    // 4. Mientras editabas (curso)
    await editarCurso("Pruebaav Kids");
    await p.fill('input[type="number"]', "22");
    await patch(admin2, `/api/cursos/${P}-curso`, { aula: "Aula del otro" });
    await p.waitForSelector("[data-aviso-cambio-ajeno]", { timeout: 8000 });
    ok("curso mientras editabas: el aula sin tocar se actualiza", await p.inputValue('input[placeholder="Aula 1"]'), "Aula del otro");
    ok("curso mientras editabas: el aviso dice quién y qué", /Mientras editabas, Pruebaav multi cambió: aula/.test(await p.textContent("[data-aviso-cambio-ajeno]")), true);
    ok("curso mientras editabas: lo escrito se conserva", await p.inputValue('input[type="number"]'), "22");

    // 5. Profesor con un teléfono viejo inválido: editar otro campo no se bloquea
    q(`update "Profesor" set telefono='2622-54555P' where id='${P}-profe'`);
    await p.goto(`${BASE}/profesores`);
    await p.getByPlaceholder("Buscar por nombre, DNI o email…").fill("Pruebaav Profe");
    ok("profesor: el filtro dejó solo al profesor de prueba", await p.locator("tr", { hasText: "Pruebaav" }).count() === await p.locator("tbody tr").count(), true);
    await p.locator("tr", { hasText: "Pruebaav Profe" }).getByTitle("Editar").first().click();
    await p.getByText("Editar profesor").first().waitFor();
    await p.locator("form input").nth(1).fill("Profesorcito");
    patches.length = 0;
    await p.getByRole("button", { name: "Guardar cambios" }).click();
    await p.waitForTimeout(900);
    ok("profesor con teléfono viejo inválido: el PATCH va al profesor de prueba y lleva solo el apellido", patches.map((x) => `${x.url.split("/").pop()} ${x.body}`).join("|"), `${P}-profe {"apellido":"Profesorcito"}`);
    ok("profesor con teléfono viejo inválido: el teléfono no se toca", q(`select telefono from "Profesor" where id='${P}-profe'`), "2622-54555P");

    // 6. Configuración: se pone al día solo y nunca pisa lo escrito
    q(`update "Configuracion" set "valorCuota"=null`);
    await p.goto(`${BASE}/configuracion`);
    const campo = p.locator('input[type="number"][step="100"]');
    await campo.waitFor();
    await p.waitForTimeout(2500); // la conexión en vivo ya tiene que estar abierta: una señal anterior a eso no existe para la pantalla
    await patch(admin2, "/api/configuracion", { valorCuota: 1111 });
    await p.waitForTimeout(2500);
    ok("configuración: sin editar se actualiza solo", await campo.inputValue(), "1111");
    await campo.fill("5000");
    await patch(admin2, "/api/configuracion", { valorCuota: 2222 });
    await p.waitForTimeout(2500);
    ok("configuración: editando no se pisa lo escrito", await campo.inputValue(), "5000");

    // 7. Chat: tope de 2000 caracteres
    const p2 = await ctx.newPage();
    await p2.goto(`${BASE}/login`);
    await b.close();
  } catch (e) {
    console.log(`ERROR: ${e}`);
  } finally {
    q(`update "Configuracion" set "valorCuota"=null`);
    try { await b.close(); } catch {}
  }
})();
