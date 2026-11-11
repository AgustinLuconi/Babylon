import { PrismaClient } from "@prisma/client";
import { ok } from "./_check";
import { CLAVE, crearMundo, email, limpiarMundo } from "./_mundo-avisos";

const API = "http://localhost:4000";
const prisma = new PrismaClient();
const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function login(quien: string, rolElegido?: string): Promise<string> {
  const r = await fetch(`${API}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: email(quien), password: CLAVE, ...(rolElegido ? { rolElegido } : {}) }),
  });
  return ((await r.json()) as { token: string }).token;
}
const pedir = (metodo: string, ruta: string, token: string, cuerpo?: unknown) =>
  fetch(`${API}${ruta}`, {
    method: metodo,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
  });

interface Conexion {
  texto: () => string;
  codigo: () => number;
  tipo: () => string;
  cerrada: () => boolean;
  cortar: () => void;
}
// Copiado de _tiempo-real.ts. Abre la conexión en vivo y junta todo lo que llega.
function abrir(token?: string, ruta = "/api/tiempo-real"): Conexion {
  const trozos: string[] = [];
  let codigo = 0;
  let tipo = "";
  let cerrada = false;
  const control = new AbortController();
  fetch(`${API}${ruta}`, { headers: token ? { Authorization: `Bearer ${token}` } : {}, signal: control.signal })
    .then(async (res) => {
      codigo = res.status;
      tipo = res.headers.get("content-type") ?? "";
      if (!res.ok || !res.body) return;
      const decodificador = new TextDecoder();
      for await (const trozo of res.body) trozos.push(decodificador.decode(trozo, { stream: true }));
    })
    .catch(() => {})
    .finally(() => {
      cerrada = true;
    });
  return { texto: () => trozos.join(""), codigo: () => codigo, tipo: () => tipo, cerrada: () => cerrada, cortar: () => control.abort() };
}
const si = (b: boolean) => (b ? "sí" : "no");

(async () => {
  const m = await crearMundo(prisma);
  const padreTk = await login("padre");
  const adminTk = await login("admin");
  const padre = abrir(padreTk);
  const admin = abrir(adminTk);
  const ajeno = abrir(await login("ajeno"));
  const profe = abrir(await login("profe"));
  await esperar(600);
  const chatId = ((await (await pedir("GET", "/api/chats/mio", padreTk)).json()) as { id: string }).id;
  await pedir("POST", `/api/chats/${chatId}/mensajes`, padreTk, { texto: "Mensaje secreto" });
  await esperar(500);
  ok("el instituto recibe la señal", si(admin.texto().includes(`event: chat\ndata: {"chatId":"${chatId}"}`)), "sí");
  ok("el padre también (otra pestaña suya se actualiza)", si(padre.texto().includes("event: chat")), "sí");
  ok("otra familia no", si(ajeno.texto().includes("event: chat")), "no");
  ok("un profesor no", si(profe.texto().includes("event: chat")), "no");
  ok("la señal no lleva el texto", si(admin.texto().includes("Mensaje secreto")), "no");
  const antes = padre.texto().split("event: chat").length;
  await pedir("POST", `/api/chats/${chatId}/leido`, adminTk);
  await esperar(500);
  ok("al leer el instituto, el padre recibe la señal (aparece el Visto)", padre.texto().split("event: chat").length, antes + 1);
  const despues = padre.texto().split("event: chat").length;
  await pedir("POST", `/api/chats/${chatId}/leido`, adminTk);
  await esperar(500);
  ok("leer sin nada pendiente no manda señal", padre.texto().split("event: chat").length, despues);
  // Una conversación nueva (todavía vacía) también aparece en la lista del resto del equipo
  await prisma.padre.create({ data: { id: "prueba-tmp-av-sincuenta", nombre: "Pruebaav", apellido: "Sincuenta", dni: "99400050" } });
  const nueva = ((await (await pedir("POST", "/api/chats", adminTk, { padreId: "prueba-tmp-av-sincuenta" })).json()) as { id: string }).id;
  await esperar(500);
  ok("crear una conversación avisa al instituto", si(admin.texto().includes(`"chatId":"${nueva}"`)), "sí");
  ok("y no a las familias", si(ajeno.texto().includes(nueva)), "no");
  [padre, admin, ajeno, profe].forEach((c) => c.cortar());
  await limpiarMundo(prisma);
  ok("limpieza", await prisma.chat.count({ where: { padreId: { startsWith: "prueba-tmp-av" } } }), 0);
  await prisma.$disconnect();
  process.exit(0);
})();
