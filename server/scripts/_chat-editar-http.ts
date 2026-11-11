// Editar y borrar mensajes por HTTP: validación, permisos y que la campana del instituto se ponga al día al borrar.
// Requiere la API en :4000 (mundo prueba-tmp-av).
import { PrismaClient } from "@prisma/client";
import { ok } from "./_check";
import { CLAVE, crearMundo, email, limpiarMundo } from "./_mundo-avisos";

const API = "http://localhost:4000";
const prisma = new PrismaClient();
async function login(quien: string): Promise<string> {
  const r = await fetch(`${API}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: email(quien), password: CLAVE }) });
  return ((await r.json()) as { token: string }).token;
}
async function pedir(metodo: string, ruta: string, token: string | null, cuerpo?: unknown) {
  const r = await fetch(`${API}${ruta}`, {
    method: metodo,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
  });
  const texto = await r.text();
  return { status: r.status, d: texto ? (JSON.parse(texto) as Record<string, unknown>) : null };
}

(async () => {
  const m = await crearMundo(prisma);
  const [padre, ajeno, secre, profe] = await Promise.all(["padre", "ajeno", "secre", "profe"].map(login));
  const chat = (await pedir("GET", "/api/chats/mio", padre)).d as { id: string };
  const enviado = (await pedir("POST", `/api/chats/${chat.id}/mensajes`, padre, { texto: "Hola con eror" })).d as { id: string };
  const ruta = `/api/chats/${chat.id}/mensajes/${enviado.id}`;
  const noLeidas = async () => ((await pedir("GET", "/api/notificaciones", secre)).d as { noLeidas: number }).noLeidas;

  ok("la campana del instituto cuenta el mensaje", await noLeidas(), 1);
  ok("sin sesión", (await pedir("PATCH", ruta, null, { texto: "x" })).status, 401);
  ok("un profesor no entra al chat", (await pedir("PATCH", ruta, profe, { texto: "x" })).status, 403);
  ok("otra familia no toca la conversación", (await pedir("PATCH", ruta, ajeno, { texto: "x" })).status, 403);
  ok("el instituto no toca un mensaje de la familia", (await pedir("PATCH", ruta, secre, { texto: "x" })).status, 403);
  ok("texto vacío", (await pedir("PATCH", ruta, padre, { texto: "   " })).status, 400);
  ok("texto de más de 2000", (await pedir("PATCH", ruta, padre, { texto: "a".repeat(2001) })).status, 400);
  ok("un campo que no existe", (await pedir("PATCH", ruta, padre, { texto: "ok", editadoEn: "2020-01-01" })).status, 400);
  ok("un mensaje que no existe", (await pedir("PATCH", `/api/chats/${chat.id}/mensajes/no-existe`, padre, { texto: "x" })).status, 404);
  ok("corregir", (await pedir("PATCH", ruta, padre, { texto: "Hola sin error" })).status, 204);
  const lista = (await pedir("GET", `/api/chats/${chat.id}/mensajes`, padre)).d as { mensajes: { texto: string; editadoEn: string | null }[] };
  ok("la lista trae el texto nuevo y la marca", `${lista.mensajes[0].texto} ${lista.mensajes[0].editadoEn !== null}`, "Hola sin error true");

  ok("borrar: la campana del instituto sigue contando antes de borrar", await noLeidas(), 1);
  ok("borrar", (await pedir("DELETE", ruta, padre)).status, 204);
  ok("borrar: la campana del instituto ya no cuenta ese mensaje", await noLeidas(), 0);
  ok("borrar otra vez no falla", (await pedir("DELETE", ruta, padre)).status, 204);
  ok("corregir uno borrado", (await pedir("PATCH", ruta, padre, { texto: "x" })).status, 409);
  const despues = (await pedir("GET", `/api/chats/${chat.id}/mensajes`, secre)).d as { mensajes: { texto: string; eliminadoEn: string | null }[] };
  ok("el instituto lo ve eliminado y sin texto", `"${despues.mensajes[0].texto}" ${despues.mensajes[0].eliminadoEn !== null}`, `"" true`);

  const viejo = (await pedir("POST", `/api/chats/${chat.id}/mensajes`, padre, { texto: "Viejo" })).d as { id: string };
  await prisma.mensaje.update({ where: { id: viejo.id }, data: { fecha: new Date(Date.now() - 16 * 60_000) } });
  ok("pasado el plazo: corregir", (await pedir("PATCH", `/api/chats/${chat.id}/mensajes/${viejo.id}`, padre, { texto: "x" })).status, 409);
  ok("pasado el plazo: borrar", (await pedir("DELETE", `/api/chats/${chat.id}/mensajes/${viejo.id}`, padre)).status, 409);

  await limpiarMundo(prisma);
  await prisma.$disconnect();
})();
