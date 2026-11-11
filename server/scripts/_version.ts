// La señal `listo` de la conexión en vivo trae la versión del servidor. Reinicia la API con dos versiones distintas.
import { execSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import { ok } from "./_check";
import { CLAVE, crearMundo, email, limpiarMundo } from "./_mundo-avisos";

const API = "http://localhost:4000";
const S = `${__dirname}/../../pruebas/bin`;
const prisma = new PrismaClient();

async function listo(): Promise<string> {
  // Tras reiniciar la API, la primera conexión reutilizada puede venir cerrada: se reintenta.
  let token = "";
  for (let i = 0; i < 3 && !token; i++) {
    try {
      const r = await fetch(`${API}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: email("admin"), password: CLAVE }) });
      token = ((await r.json()) as { token: string }).token;
    } catch {
      await new Promise((r) => setTimeout(r, 300));
    }
  }
  const control = new AbortController();
  const res = await fetch(`${API}/api/tiempo-real`, { headers: { Authorization: `Bearer ${token}` }, signal: control.signal });
  const dec = new TextDecoder();
  let texto = "";
  let resultado = "";
  try {
    for await (const trozo of res.body!) {
      texto += dec.decode(trozo, { stream: true });
      const m = /event: listo\n(data: .*\n)?\n/.exec(texto);
      if (m) {
        resultado = (m[1] ?? "").trim();
        break;
      }
    }
  } catch {
    // Cortar la conexión termina la lectura con un error de "abortado".
  }
  control.abort();
  return resultado;
}

(async () => {
  await crearMundo(prisma);
  execSync(`APP_VERSION=prueba-1 bash "${S}/reiniciar-api.sh"`);
  ok("listo trae la versión", await listo(), 'data: {"version":"prueba-1"}');
  execSync(`APP_VERSION=prueba-2 bash "${S}/reiniciar-api.sh"`);
  ok("con otra versión, otra", await listo(), 'data: {"version":"prueba-2"}');
  execSync(`bash "${S}/reiniciar-api.sh"`);
  ok("sin APP_VERSION ni compilación, desarrollo", await listo(), 'data: {"version":"desarrollo"}');
  await limpiarMundo(prisma);
  await prisma.$disconnect();
  process.exit(0);
})();
