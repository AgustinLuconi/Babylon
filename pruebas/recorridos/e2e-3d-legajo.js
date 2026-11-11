// 3d, Tarea 10: legajo — editar manda solo lo que cambió, un dato viejo inválido no bloquea, "Mientras editabas…" y
// asignar responsable.
const { chromium } = require("playwright");
const { execSync } = require("child_process");
const ok = (e, r, x) => console.log(`${e}: ${r} (esperado ${x})`);
const BASE = "http://localhost:5173";
const API = "http://localhost:4000";
const q = (sql) => execSync(`docker exec babylon-postgres psql -U babylon -d babylon -tAc "${sql.replace(/"/g, '\\"')}"`).toString().trim();
const email = (x) => `prueba-tmp-av-${x}@prueba.babylon.test`;
const P = "prueba-tmp-av";

async function tokenDe(quien) {
  const r = await fetch(`${API}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: email(quien), password: "prueba1234" }) });
  return (await r.json()).token;
}

(async () => {
  const b = await chromium.launch({ executablePath: "/usr/bin/google-chrome" });
  const p = await b.newPage({ viewport: { width: 1280, height: 1100 } });
  const patches = [];
  p.on("request", (r) => { if (r.method() === "PATCH") patches.push({ url: r.url(), body: r.postData() }); });
  const abrir = async (id) => { await p.goto(`${BASE}/alumnos/${id}`); await p.getByRole("button", { name: "Editar datos" }).click(); await p.waitForSelector("#alumno-nombre"); };
  const guardar = async () => { patches.length = 0; await p.getByRole("button", { name: "Guardar cambios" }).click(); await p.waitForTimeout(900); };
  try {
    await p.goto(`${BASE}/login`);
    await p.fill('input[name="email"]', email("secre"));
    await p.fill('input[name="password"]', "prueba1234");
    await p.click('button[type="submit"]');
    await p.waitForURL((u) => !u.pathname.startsWith("/login"));
    q(`update "Alumno" set direccion='Calle 1' where id='${P}-hijo1'`);

    // 1. Editar solo el celular: el PATCH lleva únicamente ese campo
    await abrir(`${P}-hijo1`);
    await p.fill("#alumno-telefono", "351 555-1234");
    await guardar();
    const patchAlumno = patches.filter((x) => x.url.includes("/api/alumnos/"));
    ok("editar un campo: el PATCH al alumno lleva solo ese campo", patchAlumno.map((x) => x.body).join("|"), '{"telefono":"351 555-1234"}');
    ok("editar un campo: no se llamó al responsable", patches.filter((x) => x.url.includes("/api/padres/")).length, 0);
    ok("editar un campo: quedó guardado normalizado", q(`select telefono from "Alumno" where id='${P}-hijo1'`), "+5493515551234");

    // 2. Vaciar la dirección manda null
    await abrir(`${P}-hijo1`);
    await p.fill("#alumno-direccion", "");
    await guardar();
    ok("vaciar: manda null", patches.filter((x) => x.url.includes("/api/alumnos/")).map((x) => x.body).join("|"), '{"direccion":null}');
    ok("vaciar: queda sin dato", q(`select coalesce(direccion,'NULO') from "Alumno" where id='${P}-hijo1'`), "NULO");

    // 3. Un celular viejo inválido no bloquea editar otro campo
    q(`update "Alumno" set telefono='2622-54555P' where id='${P}-hijo1'`);
    await abrir(`${P}-hijo1`);
    await p.fill("#alumno-direccion", "Calle nueva 5");
    await guardar();
    ok("dato viejo inválido: se guarda la dirección", q(`select direccion from "Alumno" where id='${P}-hijo1'`), "Calle nueva 5");
    ok("dato viejo inválido: el celular viejo no se toca", q(`select telefono from "Alumno" where id='${P}-hijo1'`), "2622-54555P");
    ok("dato viejo inválido: se cerró el formulario sin error", await p.locator("#alumno-nombre").count(), 0);

    // 4. Mientras editabas
    const admin = await tokenDe("admin");
    const otro = (cuerpo) => fetch(`${API}/api/alumnos/${P}-hijo1`, { method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${admin}` }, body: JSON.stringify(cuerpo) });
    await abrir(`${P}-hijo1`);
    await p.fill("#alumno-telefono", "11 5555 1234");
    await otro({ direccion: "Dirección del otro" });
    await p.waitForSelector("[data-aviso-cambio-ajeno]", { timeout: 8000 });
    ok("mientras editabas: el campo sin tocar se actualiza solo", await p.inputValue("#alumno-direccion"), "Dirección del otro");
    const aviso = await p.textContent("[data-aviso-cambio-ajeno]");
    ok("mientras editabas: el aviso dice quién y qué", /Mientras editabas, Pruebaav admin cambió: dirección/.test(aviso), true);
    ok("mientras editabas: lo escrito se conserva", await p.inputValue("#alumno-telefono"), "11 5555 1234");
    // El otro cambia el mismo campo que se está editando: no aparece nada nuevo y se conserva lo escrito.
    await p.locator("[data-aviso-cambio-ajeno] button").click();
    await otro({ telefono: "351 555-9999" });
    await p.waitForTimeout(3500);
    ok("mismo campo: se conserva lo escrito", await p.inputValue("#alumno-telefono"), "11 5555 1234");
    ok("mismo campo: no aparece ningún aviso nuevo", await p.locator("[data-aviso-cambio-ajeno]").count(), 0);
    await guardar();
    ok("mismo campo: se guarda lo del que edita", q(`select telefono from "Alumno" where id='${P}-hijo1'`), "+5491155551234");

    // 5. Asignar responsable a un alumno que no tiene
    q(`insert into "Alumno" (id, nombre, apellido, dni, "fechaNacimiento", "fechaInscripcion", estado, "cursoId", "aplicaDescuentoHermanos") values ('${P}-sinresp','Pruebaav','Sinresp','99400120','1990-01-01', now(), 'activo', '${P}-curso', false)`);
    await p.goto(`${BASE}/alumnos/${P}-sinresp`);
    await p.getByRole("button", { name: "Asignar responsable" }).click();
    await p.getByText("Pruebaav padre").first().click();
    await p.selectOption("#vinculoExistente", "madre");
    await p.getByRole("button", { name: "Guardar", exact: true }).click();
    await p.waitForTimeout(1000);
    ok("asignar responsable: queda con el responsable y el vínculo", q(`select "padreId" || ' ' || "vinculoResponsable" from "Alumno" where id='${P}-sinresp'`), `${P}-padre madre`);
    ok("asignar responsable: el legajo lo muestra", (await p.textContent("body")).includes("Cambiar responsable"), true);
  } finally {
    await b.close();
  }
})();
