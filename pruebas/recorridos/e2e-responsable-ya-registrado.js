// Al cargar un responsable nuevo, el sistema avisa mientras se escribe si ya hay uno registrado con el mismo DNI, celular o
// email, y deja vincularlo directo: no ofrece "es otra persona" y no deja crear la ficha duplicada.
const { chromium } = require("playwright");
const { execSync } = require("child_process");
const ok = (e, r, x) => console.log(`${e}: ${r} (esperado ${x})`);
const BASE = "http://localhost:5173";
const q = (sql) => execSync(`docker exec babylon-postgres psql -U babylon -d babylon -tAc "${sql.replace(/"/g, '\\"')}"`).toString().trim();
const email = (x) => `prueba-tmp-av-${x}@prueba.babylon.test`;
const CURSO = "prueba-tmp-av-curso";

(async () => {
  const b = await chromium.launch({ executablePath: "/usr/bin/google-chrome" });
  const p = await b.newPage({ viewport: { width: 1280, height: 1100 } });
  const siguiente = async () => { await p.getByRole("button", { name: /Siguiente/ }).click(); await p.waitForTimeout(250); };
  const empezar = async (apellido) => {
    await p.goto(`${BASE}/alumnos/inscribir`);
    await p.fill("#nombre", "Pruebaav");
    await p.fill("#apellido", apellido);
    await siguiente();
    await p.selectOption("#curso", CURSO);
    await siguiente();
  };
  const nuevoResponsable = async (datos) => {
    await p.getByRole("button", { name: "Cargar uno nuevo" }).click();
    await p.fill("#responsableNombre", datos.nombre);
    await p.fill("#responsableApellido", datos.apellido);
    await p.fill("#responsableTelefono", datos.telefono);
    if (datos.dni) await p.fill("#responsableDni", datos.dni);
    if (datos.email) await p.fill("#responsableEmail", datos.email);
    await p.selectOption("#responsableVinculo", datos.vinculo ?? "madre");
  };
  try {
    await p.goto(`${BASE}/login`);
    await p.fill('input[name="email"]', email("secre"));
    await p.fill('input[name="password"]', "prueba1234");
    await p.click('button[type="submit"]');
    await p.waitForURL((u) => !u.pathname.startsWith("/login"));

    // Primer hijo, con un responsable completo.
    await empezar("E2Ehijo1");
    await nuevoResponsable({ nombre: "Pruebaav", apellido: "Coincide", telefono: "351 555-7000", dni: "99400301", email: "coincide@prueba.babylon.test" });
    await siguiente();
    await p.getByRole("button", { name: "Confirmar inscripción" }).click();
    await p.waitForURL("**/alumnos");
    const fichaId = q(`select id from "Padre" where apellido='Coincide'`);
    ok("el primer hijo crea la ficha", q(`select count(*) from "Padre" where apellido='Coincide'`), 1);

    // Segundo hijo: otra persona con el mismo celular.
    await empezar("E2Ehijo2");
    await nuevoResponsable({ nombre: "Pruebaav", apellido: "Distinto", telefono: "351 555-7000" });
    await p.locator("[data-ficha-coincide]").waitFor({ timeout: 4000 });
    const aviso = await p.locator("[data-ficha-coincide]").textContent();
    ok("mismo celular: aparece el aviso con esa ficha", `${aviso.includes("Coincide")} ${aviso.includes("celular")} ${aviso.includes("E2Ehijo1")}`, "true true true");
    ok("mismo celular: no se ofrece 'es otra persona'", await p.getByRole("button", { name: "Es otra persona" }).count(), 0);
    await siguiente();
    ok("mismo celular: sin resolver no avanza", await p.locator("#responsableNombre").isVisible(), true);
    ok("mismo celular: dice qué hacer", (await p.textContent("body")).includes("usá esa ficha o corregí el dato repetido"), true);

    // Corregir el dato hace desaparecer el aviso; escribir otro dato repetido lo trae de vuelta.
    await p.fill("#responsableTelefono", "351 555-7001");
    await p.waitForTimeout(300);
    ok("celular corregido: el aviso desaparece", await p.locator("[data-ficha-coincide]").count(), 0);
    await p.fill("#responsableDni", "99.400.301");
    await p.locator("[data-ficha-coincide]").waitFor({ timeout: 4000 });
    ok("mismo DNI (con puntos): aparece el aviso", (await p.locator("[data-ficha-coincide]").textContent()).includes("DNI"), true);
    await p.fill("#responsableDni", "");
    await p.fill("#responsableEmail", "COINCIDE@prueba.babylon.test");
    await p.locator("[data-ficha-coincide]").waitFor({ timeout: 4000 });
    ok("mismo email (en mayúsculas): aparece el aviso", (await p.locator("[data-ficha-coincide]").textContent()).includes("email"), true);

    // Vincular directo a la ficha registrada.
    await p.locator("[data-usar-ficha]").click();
    await p.waitForSelector("#vinculoExistente");
    ok("usar esa ficha: pasa a 'Ya existe en el sistema'", await p.locator("#vinculoExistente").isVisible(), true);
    ok("usar esa ficha: avisa del descuento por hermanos", (await p.textContent("body")).includes("descuento del 10%"), true);
    await p.selectOption("#vinculoExistente", "madre");
    await siguiente();
    await p.getByRole("button", { name: "Confirmar inscripción" }).click();
    await p.waitForURL("**/alumnos");
    ok("el segundo hijo quedó con la misma ficha", q(`select "padreId" from "Alumno" where apellido='E2Ehijo2'`), fichaId);
    ok("no se creó ninguna ficha duplicada", q(`select count(*) from "Padre" where nombre='Pruebaav' and apellido in ('Coincide','Distinto')`), 1);
  } finally {
    await b.close();
  }
})();
