// Cambios sin guardar: salir de una pantalla con algo escrito pregunta antes. Antes: _mundo-avisos.ts crear.
const { chromium } = require("playwright");
const ok = (e, r, x) => console.log(`${e}: ${r} (esperado ${x})`);
const BASE = "http://localhost:5173";
const API = "http://localhost:4000";
const email = (x) => `prueba-tmp-av-${x}@prueba.babylon.test`;
const PREGUNTA = "Tenés cambios sin guardar. ¿Salir igual?";
async function entrar(p, quien) {
  await p.goto(`${BASE}/login`);
  await p.fill('input[name="email"]', email(quien));
  await p.fill('input[name="password"]', "prueba1234");
  await p.click('button[type="submit"]');
  await p.waitForURL((u) => !u.pathname.startsWith("/login"));
}
async function loginApi(quien) {
  const r = await fetch(`${API}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: email(quien), password: "prueba1234" }) });
  return (await r.json()).token;
}
const pedir = (metodo, ruta, token, cuerpo) => fetch(`${API}${ruta}`, { method: metodo, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: cuerpo ? JSON.stringify(cuerpo) : undefined });
const pregunta = (p) => p.locator(`text=${PREGUNTA}`).count();

(async () => {
  const navegador = await chromium.launch({ executablePath: "/usr/bin/google-chrome" });

  // Profesor con asistencia marcada sin guardar
  const profe = await navegador.newPage();
  await entrar(profe, "profe");
  await profe.goto(`${BASE}/asistencia`);
  await profe.waitForSelector("button:has-text('Presente')");
  await profe.click("nav a:has-text('Calificaciones')");
  await profe.waitForTimeout(500);
  ok("sin nada marcado, navega sin preguntar", new URL(profe.url()).pathname, "/calificaciones");
  await profe.goto(`${BASE}/asistencia`);
  await profe.waitForSelector("button:has-text('Presente')");
  await profe.locator("button:has-text('Presente')").first().click();
  await profe.click("nav a:has-text('Calificaciones')");
  await profe.waitForTimeout(500);
  ok("con algo marcado, el menú pregunta", await pregunta(profe), 1);
  await profe.click("button:has-text('Seguir editando')");
  await profe.waitForTimeout(300);
  ok("seguir editando: se queda", new URL(profe.url()).pathname, "/asistencia");
  // El primer botón "Presente" marca a toda la nómina: los 2 alumnos del curso de prueba.
  ok("y conserva lo marcado", await profe.locator("button:has-text('Presente')[aria-pressed='true']").count(), 2);
  // Cambiar la fecha (un filtro de la dirección) también descarta lo marcado: pregunta
  await profe.fill('input[type="date"]', "2026-10-13");
  await profe.waitForTimeout(500);
  ok("cambiar un filtro de la dirección pregunta", await pregunta(profe), 1);
  await profe.click("button:has-text('Seguir editando')");
  await profe.waitForTimeout(300);
  ok("y no cambia la fecha", new URL(profe.url()).searchParams.get("fecha") === "2026-10-13" ? "cambió" : "no cambió", "no cambió");
  // Recargar con algo sin guardar: el navegador pide confirmación
  let dialogo = "ninguno";
  profe.once("dialog", async (d) => {
    dialogo = d.type();
    await d.dismiss();
  });
  await profe.evaluate(() => setTimeout(() => location.reload(), 0));
  await profe.waitForTimeout(1000);
  ok("recargar pide confirmación", dialogo, "beforeunload");
  await profe.click("nav a:has-text('Calificaciones')");
  await profe.waitForTimeout(500);
  await profe.click("button:has-text('Salir sin guardar')");
  await profe.waitForTimeout(500);
  ok("salir sin guardar: navega", new URL(profe.url()).pathname, "/calificaciones");

  // Admin con "Editar datos" de un alumno modificado: la cruz pregunta
  const admin = await navegador.newPage();
  await entrar(admin, "admin");
  await admin.goto(`${BASE}/alumnos/prueba-tmp-av-hijo1`);
  await admin.click("button:has-text('Editar datos')");
  await admin.locator(".fixed.inset-0 input").first().fill("Tomasav cambiado");
  await admin.click(".fixed.inset-0 button[aria-label='Cerrar']");
  await admin.waitForTimeout(300);
  ok("cerrar un modal con cambios pregunta", await pregunta(admin), 1);
  await admin.click("button:has-text('Salir sin guardar')");
  await admin.waitForTimeout(300);
  ok("y salir lo cierra", await admin.locator("text=Editar datos").count() <= 1 ? "cerrado" : "abierto", "cerrado");
  await admin.click("button:has-text('Editar datos')");
  await admin.click(".fixed.inset-0 button[aria-label='Cerrar']");
  await admin.waitForTimeout(300);
  ok("sin cambios, la cruz cierra sin preguntar", await pregunta(admin), 0);

  // Chat con un borrador: cambiar de conversación pregunta
  const adminTk = await loginApi("admin");
  const padreTk = await loginApi("padre");
  const chatPadre = (await (await pedir("GET", "/api/chats/mio", padreTk)).json()).id;
  const chatAjeno = (await (await pedir("POST", "/api/chats", adminTk, { padreId: "prueba-tmp-av-ajeno" })).json()).id;
  await admin.goto(`${BASE}/chats?conversacion=${chatPadre}`);
  await admin.waitForSelector("[data-conversacion-abierta]");
  await admin.fill('input[placeholder^="Escribir un mensaje"]', "Borrador");
  await admin.click(`[data-conversacion="${chatAjeno}"]`);
  await admin.waitForTimeout(400);
  ok("cambiar de conversación con un borrador pregunta", await pregunta(admin), 1);
  await navegador.close();
})();
