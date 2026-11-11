const { chromium } = require("playwright");
const { execSync } = require("child_process");
const ok = (e, r, x) => console.log(`${e}: ${r} (esperado ${x})`);
const q = (sql) => execSync(`docker exec babylon-postgres psql -U babylon -d babylon -tAc "${sql.replace(/"/g, '\\"')}"`).toString().trim();
(async () => {
  const n = await chromium.launch({ executablePath: "/usr/bin/google-chrome" });
  const p = await n.newPage({ viewport: { width: 1280, height: 900 } });
  await p.goto("http://localhost:5173/login");
  await p.fill('input[name="email"]', "prueba-tmp-av-profe@prueba.babylon.test");
  await p.fill('input[name="password"]', "prueba1234");
  await p.click('button[type="submit"]');
  await p.waitForURL((u) => !u.pathname.startsWith("/login"));
  // Asistencia del 13/10 (martes) en el curso con alumnos
  await p.goto("http://localhost:5173/asistencia?curso=prueba-tmp-av-curso&fecha=2026-10-13");
  await p.waitForTimeout(1500);
  await p.click("text=Marcar todos como presentes");
  await p.click("button:has-text('Guardar asistencia')");
  await p.waitForTimeout(1500);
  ok("asistencia guardada para los 2 alumnos", q("select count(*) from \"Asistencia\" where \"cursoId\"='prueba-tmp-av-curso' and fecha='2026-10-13'"), "2");
  ok("la fecha sigue en la dirección después de guardar", new URL(p.url()).searchParams.get("fecha"), "2026-10-13");
  // Notas de Unit A
  await p.goto("http://localhost:5173/calificaciones?curso=prueba-tmp-av-curso&evaluacion=prueba-tmp-av-ea");
  await p.waitForSelector('input[type="number"]');
  const notas = p.locator('input[type="number"]');
  await notas.nth(0).fill("8");
  await notas.nth(1).fill("9");
  await p.click("button:has-text('Guardar notas')");
  await p.waitForTimeout(1500);
  ok("notas guardadas", q("select count(*) from \"Calificacion\" where \"evaluacionId\"='prueba-tmp-av-ea'"), "2");
  ok("lo tipeado sigue en pantalla", await notas.nth(0).inputValue(), "8");
  await p.click("button:has-text('Publicar notas')");
  await p.waitForTimeout(500);
  const confirmar = p.locator("button:has-text('Publicar')").last();
  if (await confirmar.isVisible()) await confirmar.click();
  await p.waitForTimeout(1500);
  ok("evaluación publicada", q("select estado from \"Evaluacion\" where id='prueba-tmp-av-ea'"), "publicada");
  await n.close();
})();
