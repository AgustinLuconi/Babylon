// Configuración: un cambio de otra persona actualiza el valor si nadie lo está editando, y nunca pisa lo que se está
// escribiendo. Deja el valor de la cuota vacío al terminar (con un valor, la tarea automática generaría cuotas).
const { chromium } = require("playwright");
const { execSync } = require("child_process");
const ok = (e, r, x) => console.log(`${e}: ${r} (esperado ${x})`);
const BASE = "http://localhost:5173";
const API = "http://localhost:4000";
const q = (sql) => execSync(`docker exec babylon-postgres psql -U babylon -d babylon -tAc "${sql.replace(/"/g, '\\"')}"`).toString().trim();
const email = (x) => `prueba-tmp-av-${x}@prueba.babylon.test`;
(async () => {
  const b = await chromium.launch({ executablePath: "/usr/bin/google-chrome" });
  const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
  try {
    await p.goto(`${BASE}/login`);
    await p.fill('input[name="email"]', email("admin"));
    await p.fill('input[name="password"]', "prueba1234");
    await p.click('button[type="submit"]');
    await p.waitForURL((u) => !u.pathname.startsWith("/login"));
    await p.goto(`${BASE}/configuracion`);
    const campo = p.locator('input[type="number"][step="100"]');
    await campo.waitFor();
    const r = await fetch(`${API}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: email("multi"), password: "prueba1234", rolElegido: "admin" }) });
    const { token } = await r.json();
    const cambiar = (valorCuota) => fetch(`${API}/api/configuracion`, { method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ valorCuota }) });
    await cambiar(1111);
    await p.waitForTimeout(1500);
    ok("sin editar: el valor se actualiza solo", await campo.inputValue(), "1111");
    await campo.fill("5000");
    await cambiar(2222);
    await p.waitForTimeout(1500);
    ok("editando: lo escrito no se pisa", await campo.inputValue(), "5000");
  } finally {
    q(`update "Configuracion" set "valorCuota" = null`);
    await b.close();
  }
})();
