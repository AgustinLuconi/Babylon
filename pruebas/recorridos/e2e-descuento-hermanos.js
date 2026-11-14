// Descuento por hermanos: el legajo dice si el alumno lo tiene y quién paga completo; cuando otra persona da de baja a un
// hermano, la pantalla abierta se actualiza sola y llega el aviso a la campana de secretaría.
const { chromium } = require("playwright");
const { execSync } = require("child_process");
const ok = (e, r, x) => console.log(`${e}: ${r} (esperado ${x})`);
const BASE = "http://localhost:5173";
const API = "http://localhost:4000";
const q = (sql) => execSync(`docker exec babylon-postgres psql -U babylon -d babylon -tAc "${sql.replace(/"/g, '\\"')}"`).toString().trim();
const email = (x) => `prueba-tmp-av-${x}@prueba.babylon.test`;

async function token(quien) {
  const r = await fetch(`${API}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: email(quien), password: "prueba1234" }) });
  return (await r.json()).token;
}

(async () => {
  // El mundo de prueba: hijo1 y hijo2 son hermanos con la misma fecha de inscripción (desempata el id: hijo1 es el primero).
  q(`update "Alumno" set "aplicaDescuentoHermanos"=true where id='prueba-tmp-av-hijo2'`);
  const b = await chromium.launch({ executablePath: "/usr/bin/google-chrome" });
  const p = await b.newPage({ viewport: { width: 1280, height: 1100 } });
  try {
    await p.goto(`${BASE}/login`);
    await p.fill('input[name="email"]', email("secre"));
    await p.fill('input[name="password"]', "prueba1234");
    await p.click('button[type="submit"]');
    await p.waitForURL((u) => !u.pathname.startsWith("/login"));

    await p.goto(`${BASE}/alumnos/prueba-tmp-av-hijo2`);
    await p.getByText("Descuento por hermanos").waitFor({ timeout: 8000 });
    const fila2 = await p.locator("div", { has: p.getByText("Descuento por hermanos", { exact: true }) }).last().textContent();
    ok("el que tiene descuento: dice sí y quién paga completo", `${fila2.includes("Sí")} ${fila2.includes("Tomasav")} ${fila2.includes("paga la cuota completa")}`, "true true true");

    await p.goto(`${BASE}/alumnos/prueba-tmp-av-hijo1`);
    await p.getByText("Descuento por hermanos").waitFor({ timeout: 8000 });
    const fila1 = await p.locator("div", { has: p.getByText("Descuento por hermanos", { exact: true }) }).last().textContent();
    ok("el que paga completo: dice no", `${fila1.includes("No")} ${fila1.includes("Sí")}`, "true false");

    // Otra persona (administración) da de baja a hijo1 mientras secretaría mira el legajo de hijo2.
    await p.goto(`${BASE}/alumnos/prueba-tmp-av-hijo2`);
    await p.getByText("Descuento por hermanos").waitFor({ timeout: 8000 });
    await p.waitForTimeout(1500); // que la conexión en vivo ya esté abierta
    const admin = await token("admin");
    const r = await fetch(`${API}/api/alumnos/prueba-tmp-av-hijo1`, { method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${admin}` }, body: JSON.stringify({ estado: "inactivo" }) });
    ok("la baja se hizo", r.status, 200);
    await p.waitForFunction(() => {
      const t = [...document.querySelectorAll("span")].find((s) => s.previousElementSibling?.textContent === "Descuento por hermanos");
      return t && t.textContent.trim() === "No";
    }, null, { timeout: 8000 });
    ok("sin recargar: el legajo pasó a 'No'", "No", "No");

    await p.getByRole("button", { name: /Notificaciones/ }).click();
    await p.getByText("pasó a pagar la cuota completa", { exact: false }).first().waitFor({ timeout: 8000 });
    const campana = await p.locator("body").textContent();
    ok("la campana trae el aviso con cuándo rige", `${campana.includes("pasó a pagar la cuota completa")} ${campana.includes("Rige desde la próxima cuota que se genere")}`, "true true");
  } finally {
    await b.close();
    q(`update "Alumno" set estado='activo', "aplicaDescuentoHermanos"=false where id in ('prueba-tmp-av-hijo1','prueba-tmp-av-hijo2')`);
  }
})().catch((e) => { console.log(`sin excepciones: ${e.message.split("\n")[0]} (esperado ninguna)`); process.exit(1); });
