const { chromium } = require("playwright");
const ok = (e, r, x) => console.log(`${e}: ${r} (esperado ${x})`);
const BASE = "http://localhost:5173";
const P = "prueba-tmp-av";
(async () => {
  const n = await chromium.launch({ executablePath: "/usr/bin/google-chrome" });
  const p = await n.newPage();
  await p.goto(`${BASE}/login`);
  await p.fill('input[name="email"]', `${P}-profe@prueba.babylon.test`);
  await p.fill('input[name="password"]', "prueba1234");
  await p.click('button[type="submit"]');
  await p.waitForURL((u) => !u.pathname.startsWith("/login"));
  // La fecha propia del curso, para comparar
  await p.goto(`${BASE}/asistencia?curso=${P}-curso`);
  await p.waitForTimeout(1500);
  const fechaPropia = await p.locator('input[type="date"]').inputValue();
  // Curso ajeno con fecha: se abre el curso propio y la fecha del enlace se descarta
  await p.goto(`${BASE}/asistencia?curso=${P}-curso-multi&fecha=2026-10-06`);
  await p.waitForTimeout(1500);
  ok("curso ajeno: la fecha del enlace se descarta", (await p.locator('input[type="date"]').inputValue()) === "2026-10-06" ? "usa la del enlace" : "la descarta", "la descarta");
  // Fecha imposible: se usa la del curso
  await p.goto(`${BASE}/asistencia?curso=${P}-curso&fecha=2026-13-45`);
  await p.waitForTimeout(1500);
  ok("fecha imposible: vuelve a la del curso", await p.locator('input[type="date"]').inputValue(), fechaPropia);
  // Una fecha válida de un curso propio se respeta
  await p.goto(`${BASE}/asistencia?curso=${P}-curso&fecha=2026-10-06`);
  await p.waitForTimeout(1500);
  ok("fecha válida: se respeta", await p.locator('input[type="date"]').inputValue(), "2026-10-06");
  await n.close();
})();
