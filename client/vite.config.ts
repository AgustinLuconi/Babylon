import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

// Versión de esta compilación del client: la fecha y hora del build ("desarrollo" con el servidor de desarrollo). La
// página la lleva adentro (__VERSION_CLIENT__) y también queda publicada en /version.json: si la publicada es otra, hay
// una versión nueva y la página abierta avisa que hay que recargar.
function versionDelClient(): Plugin {
  let version = "desarrollo";
  return {
    name: "version-del-client",
    config(_, { command }) {
      if (command === "build") version = new Date().toISOString();
      return { define: { __VERSION_CLIENT__: JSON.stringify(version) } };
    },
    configureServer(server) {
      server.middlewares.use("/version.json", (_req, res) => {
        res.setHeader("Content-Type", "application/json");
        res.setHeader("Cache-Control", "no-store");
        res.end(JSON.stringify({ version }));
      });
    },
    generateBundle() {
      this.emitFile({ type: "asset", fileName: "version.json", source: JSON.stringify({ version }) });
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), versionDelClient()],
  resolve: {
    alias: {
      // import.meta.dirname (Node 20.11+) en vez de __dirname: Vite avisa que
      // __dirname no es compatible con el nuevo configLoader "native".
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  server: {
    port: 5173,
  },
});
