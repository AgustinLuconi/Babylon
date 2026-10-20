import { readFileSync } from "node:fs";
import path from "node:path";

// Versión del servidor que recibe el navegador al conectarse (señal `listo`): si cambia entre una conexión y la
// siguiente (un despliegue reinicia el servidor y corta la conexión), la página abierta es de una versión vieja.
// Orden: APP_VERSION (si el despliegue la define); si no, la que `pnpm build` deja en dist/version.json (junto al
// código compilado); si no, "desarrollo" (corriendo desde src/ con tsx).
function leerVersion(): string {
  if (process.env.APP_VERSION) return process.env.APP_VERSION;
  try {
    const { version } = JSON.parse(readFileSync(path.join(__dirname, "..", "version.json"), "utf8")) as { version?: string };
    if (version) return version;
  } catch {
    // Sin archivo de versión: no es una compilación.
  }
  return "desarrollo";
}

export const VERSION_SERVIDOR = leerVersion();
