// 3d: la protección de cambios sin guardar sigue andando en lo que se rehízo (inscripción, editar datos, responsable).
const { chromium } = require("playwright");
const ok = (e, r, x) => console.log(`${e}: ${r} (esperado ${x})`);
const BASE = "http://localhost:5173";
const email = (x) => `prueba-tmp-av-${x}@prueba.babylon.test`;
const P = "prueba-tmp-av";
(async () => {
  const b = await chromium.launch({ executablePath: "/usr/bin/google-chrome" });
  const p = await b.newPage({ viewport: { width: 1280, height: 1000 } });
  const pregunta = async () => p.getByText("Tenés cambios sin guardar").first().isVisible().catch(() => false);
  try {
    await p.goto(`${BASE}/login`);
    await p.fill('input[name="email"]', email("secre"));
    await p.fill('input[name="password"]', "prueba1234");
    await p.click('button[type="submit"]');
    await p.waitForURL((u) => !u.pathname.startsWith("/login"));

    // Inscripción: escribir y salir pregunta
    await p.goto(`${BASE}/alumnos/inscribir`);
    await p.fill("#nombre", "Algo");
    await p.getByRole("link", { name: "Cuotas" }).first().click();
    await p.waitForTimeout(500);
    ok("inscripción: salir con algo escrito pregunta", await pregunta(), true);
    await p.getByRole("button", { name: /Quedarme|Cancelar|Seguir/ }).first().click().catch(() => {});

    // Editar datos: un cambio sin guardar protege el modal (la cruz pregunta)
    await p.goto(`${BASE}/alumnos/${P}-hijo1`);
    await p.getByRole("button", { name: "Editar datos" }).click();
    await p.fill("#alumno-direccion", "Un cambio");
    await p.getByLabel("Cerrar").click();
    await p.waitForTimeout(400);
    ok("editar datos: cerrar con un cambio pregunta", await pregunta(), true);
  } finally {
    await b.close();
  }
})();
