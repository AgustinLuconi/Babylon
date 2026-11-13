// 3d, Tarea 9: inscribir con lo mínimo (menor y adulto), ayuda contra fichas parecidas y error de DNI al lado del campo.
const { chromium } = require("playwright");
const { execSync } = require("child_process");
const ok = (e, r, x) => console.log(`${e}: ${r} (esperado ${x})`);
const BASE = "http://localhost:5173";
const q = (sql) => execSync(`docker exec babylon-postgres psql -U babylon -d babylon -tAc "${sql.replace(/"/g, '\\"')}"`).toString().trim();
const email = (x) => `prueba-tmp-av-${x}@prueba.babylon.test`;
const CURSO = "prueba-tmp-av-curso";

(async () => {
  const b = await chromium.launch({ executablePath: "/usr/bin/google-chrome" });
  const p = await b.newPage({ viewport: { width: 1280, height: 1000 } });
  const siguiente = async () => { await p.getByRole("button", { name: /Siguiente/ }).click(); await p.waitForTimeout(250); };
  const empezar = async (alumno) => {
    await p.goto(`${BASE}/alumnos/inscribir`);
    await p.fill("#nombre", alumno.nombre ?? "Pruebaav");
    await p.fill("#apellido", alumno.apellido);
    if (alumno.dni) await p.fill("#dni", alumno.dni);
    if (alumno.fecha) await p.fill("#fechaNacimiento", alumno.fecha);
    await siguiente();
    await p.selectOption("#curso", CURSO);
    await siguiente();
  };
  try {
    await p.goto(`${BASE}/login`);
    await p.fill('input[name="email"]', email("secre"));
    await p.fill('input[name="password"]', "prueba1234");
    await p.click('button[type="submit"]');
    await p.waitForURL((u) => !u.pathname.startsWith("/login"));

    // A. Menor con lo mínimo
    await empezar({ apellido: "E2Emenor" });
    await p.getByRole("button", { name: "Cargar uno nuevo" }).click();
    await p.fill("#responsableNombre", "Pruebaav");
    await p.fill("#responsableApellido", "E2Eresp");
    await p.fill("#responsableTelefono", "351 555-1234");
    await p.selectOption("#responsableVinculo", "madre");
    await siguiente();
    ok("menor: el resumen avisa lo que queda pendiente", (await p.textContent("body")).includes("Quedan para completar después"), true);
    await p.getByRole("button", { name: "Confirmar inscripción" }).click();
    await p.waitForURL("**/alumnos");
    ok("menor: queda inscripto con vínculo madre", q(`select "vinculoResponsable" from "Alumno" where apellido='E2Emenor'`), "madre");
    ok("menor: la ficha tiene el celular normalizado y no tiene DNI", q(`select p.telefono || ' ' || coalesce(p.dni,'sin') from "Padre" p join "Alumno" a on a."padreId"=p.id where a.apellido='E2Emenor'`), "+5493515551234 sin");

    // B. Adulto responsable de sí mismo
    await empezar({ apellido: "E2Eadulto", dni: "99400201", fecha: "1990-05-05" });
    await p.getByRole("button", { name: "Es responsable de sí mismo" }).click();
    await p.fill("#propioTelefono", "0351 15 555 1234");
    await siguiente();
    await p.getByRole("button", { name: "Confirmar inscripción" }).click();
    await p.waitForURL("**/alumnos");
    ok("adulto: vínculo propio y ficha con sus datos", q(`select a."vinculoResponsable" || ' ' || p.dni || ' ' || p.telefono from "Alumno" a join "Padre" p on p.id=a."padreId" where a.apellido='E2Eadulto'`), "propio 99400201 +5493515551234");

    // C. Ficha parecida: hay que elegir antes de seguir
    await empezar({ apellido: "E2Eparecida" });
    await p.getByRole("button", { name: "Cargar uno nuevo" }).click();
    await p.fill("#responsableNombre", "Pruebaav");
    await p.fill("#responsableApellido", "ajeno");
    await p.fill("#responsableTelefono", "351 555-2000");
    await p.selectOption("#responsableVinculo", "tutor");
    ok("parecida: aparece la pregunta", await p.locator("[data-fichas-parecidas]").isVisible(), true);
    await siguiente();
    ok("parecida: sin elegir no avanza", await p.locator("#responsableNombre").isVisible(), true);
    await p.getByRole("button", { name: "Es otra persona" }).click();
    await siguiente();
    ok("parecida: eligiendo 'es otra persona' avanza", (await p.textContent("body")).includes("Confirmar inscripción"), true);

    // D. DNI repetido: el error aparece al lado del DNI del alumno
    await empezar({ apellido: "E2Edni", dni: "99400011" });
    await p.getByRole("button", { name: "Cargar uno nuevo" }).click();
    await p.fill("#responsableNombre", "Pruebaav");
    await p.fill("#responsableApellido", "E2Edni");
    await p.fill("#responsableTelefono", "351 555-3000");
    await p.selectOption("#responsableVinculo", "padre");
    await siguiente();
    await p.getByRole("button", { name: "Confirmar inscripción" }).click();
    await p.waitForTimeout(800);
    ok("dni repetido: vuelve al paso del alumno", await p.locator("#dni").isVisible(), true);
    ok("dni repetido: el mensaje está en el campo del DNI", (await p.textContent("body")).includes("Ya existe un alumno inscripto con el DNI 99400011"), true);
    ok("dni repetido: no quedó ninguna ficha nueva", q(`select count(*) from "Padre" where apellido='E2Edni'`), 0);

    // E. Adulto propio con el DNI de una ficha que ya existe: se muestra la ficha; si el nombre no coincide hay que confirmar.
    await empezar({ nombre: "Otra", apellido: "Persona", dni: "99400002", fecha: "1985-02-02" });
    await p.getByRole("button", { name: "Es responsable de sí mismo" }).click();
    await p.fill("#propioTelefono", "351 555-1234");
    ok("DNI de otra ficha: se muestra la ficha encontrada", (await p.locator("[data-ficha-por-dni]").textContent().catch(() => "")).includes("Pruebaav ajeno"), true);
    await siguiente();
    ok("DNI de otra ficha con otro nombre: sin confirmar no avanza", await p.locator("#propioTelefono").isVisible(), true);
    await p.getByRole("button", { name: "Es la misma persona" }).click();
    await siguiente();
    ok("DNI de otra ficha con otro nombre: confirmando avanza", (await p.textContent("body")).includes("Confirmar inscripción"), true);
    // Mismo nombre que la ficha: se muestra el aviso pero no hace falta confirmar.
    await empezar({ nombre: "Pruebaav", apellido: "ajeno", dni: "99400002", fecha: "1985-02-02" });
    await p.getByRole("button", { name: "Es responsable de sí mismo" }).click();
    await p.fill("#propioTelefono", "351 555-1234");
    ok("DNI de otra ficha con el mismo nombre: se muestra el aviso", await p.locator("[data-ficha-por-dni]").isVisible().catch(() => false), true);
    await siguiente();
    ok("DNI de otra ficha con el mismo nombre: avanza sin confirmar", (await p.textContent("body")).includes("Confirmar inscripción"), true);
  } finally {
    await b.close();
  }
})();
