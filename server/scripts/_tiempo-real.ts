import { PrismaClient } from "@prisma/client";
import jwt from "jsonwebtoken";
import { config } from "../src/core/config";
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
// Abre la conexión en vivo y junta todo lo que llega.
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
const motivo = (c: Conexion) => /event: sesion-cerrada\ndata: (.*)\n/.exec(c.texto())?.[1] ?? "ninguno";
const sid = (token: string) => (jwt.decode(token) as { sid: string }).sid;
const si = (b: boolean) => (b ? "sí" : "no");

(async () => {
  const m = await crearMundo(prisma);

  // 1) Sin token, o con el token en la dirección: rechazada
  const padreToken = await login("padre");
  const sinToken = abrir();
  const enLaDireccion = abrir(undefined, `/api/tiempo-real?token=${padreToken}`);
  await esperar(500);
  ok("1: sin token", sinToken.codigo(), 401);
  ok("1: con el token en la dirección", enLaDireccion.codigo(), 401);

  // 2) Abre como SSE y avisa que está lista
  const padre = abrir(padreToken);
  await esperar(500);
  ok("2: abre", padre.codigo(), 200);
  ok("2: es SSE", padre.tipo(), "text/event-stream; charset=utf-8");
  ok("2: avisa que está lista", si(padre.texto().includes("event: listo")), "sí");

  // 3) Un aviso nuevo llega al instante y sin datos personales
  const profeToken = await login("profe");
  await pedir("POST", "/api/observaciones", profeToken, { alumnoId: m.hijo1, texto: "Muy bien", categoria: "felicitacion" });
  await esperar(500);
  ok("3: llega la señal", si(/event: notificaciones\ndata: \{"noLeidas":\d+\}/.test(padre.texto())), "sí");
  ok("3: sin nombres ni textos", padre.texto().includes("Tomasav") ? "con datos" : "sin datos", "sin datos");

  // 4) La cuenta con dos roles recibe solo en el rol del aviso
  const multiAdmin = abrir(await login("multi", "admin"));
  const multiProfe = abrir(await login("multi", "profesor"));
  const abiertaEn = Date.now(); // multiAdmin sigue abierta hasta el final (recibe el latido)
  await esperar(500);
  const enTresDias = new Date(Date.now() + 3 * 864e5).toISOString().slice(0, 10);
  await pedir("POST", "/api/calificaciones/evaluaciones", profeToken, {
    cursoId: m.cursoId, nombre: "Unit Vivo", tipo: "examen", fecha: enTresDias, periodo: "noviembre",
  });
  await esperar(500);
  ok("4: le llega como admin", si(multiAdmin.texto().includes("event: notificaciones")), "sí");
  ok("4: no le llega como profesora", si(multiProfe.texto().includes("event: notificaciones")), "no");

  // 5) Una conexión por sesión
  const padreBis = abrir(padreToken);
  await esperar(500);
  ok("5: la anterior se entera", si(padre.texto().includes("event: reemplazada")), "sí");
  ok("5: y se cierra", si(padre.cerrada()), "sí");
  ok("5: la nueva queda abierta", si(padreBis.cerrada()), "no");

  // 6) Hasta 10 aperturas por minuto por sesión
  const otraSesion = await login("padre");
  const aperturas: Conexion[] = [];
  for (let i = 0; i < 10; i++) {
    aperturas.push(abrir(otraSesion));
    await esperar(60);
  }
  await esperar(300);
  const once = abrir(otraSesion);
  await esperar(300);
  ok("6: la apertura 11 en un minuto", once.codigo(), 429);
  ok("6: no afecta a otra sesión", si(padreBis.cerrada()), "no");
  aperturas.forEach((c) => c.cortar());

  // 7) Cierres de sesión, cada uno con su motivo
  const s1 = await login("padre");
  const s2 = await login("padre");
  const s3 = await login("padre");
  const c1 = abrir(s1);
  const c2 = abrir(s2);
  const c3 = abrir(s3);
  await esperar(500);
  await pedir("DELETE", `/api/auth/sesiones/${sid(s2)}`, s1);
  await esperar(500);
  ok("7: cerrar otra sesión", motivo(c2), '{"motivo":"cerrada-desde-otro-dispositivo"}');
  ok("7: la que la cerró sigue abierta", si(c1.cerrada()), "no");
  await pedir("POST", "/api/auth/sesiones/cerrar-otras", s1);
  await esperar(500);
  ok("7: cerrar todas las demás", motivo(c3), '{"motivo":"cerrada-desde-otro-dispositivo"}');
  await pedir("POST", "/api/auth/logout", s1);
  await esperar(500);
  ok("7: cerrar sesión", motivo(c1), '{"motivo":"cerrada-por-el-usuario"}');
  const p1 = await login("profe");
  const p2 = await login("profe");
  const cp1 = abrir(p1);
  const cp2 = abrir(p2);
  await esperar(500);
  await pedir("PATCH", `/api/auth/usuarios/${m.profe}`, await login("admin"), { password: "otraClave2026" });
  await esperar(500);
  ok("7: cambiar la contraseña", motivo(cp2), '{"motivo":"contrasena-cambiada"}');
  ok("7: el administrador cierra todas las sesiones de esa cuenta", motivo(cp1), '{"motivo":"contrasena-cambiada"}');
  const ajeno = abrir(await login("ajeno"));
  await esperar(500);
  await pedir("PATCH", `/api/auth/usuarios/${m.ajeno}/estado`, await login("admin"), { estado: "inactivo" });
  await esperar(500);
  ok("7: desactivar la cuenta", motivo(ajeno), '{"motivo":"cuenta-desactivada"}');
  const vieja = abrir(await login("admin"));
  await esperar(300);
  for (let i = 0; i < 10; i++) await login("admin");
  await esperar(500);
  ok("7: tope de 10 sesiones", motivo(vieja), '{"motivo":"cerrada-desde-otro-dispositivo"}');

  // 8) Al vencer el token se corta con "vencida" (un token de 3 segundos sobre una sesión real)
  const { sub, rol, sid: sesion } = jwt.decode(await login("multi", "admin")) as { sub: string; rol: string; sid: string };
  const corta = abrir(jwt.sign({ sub, rol, sid: sesion }, config.JWT_SECRET, { expiresIn: 3 }));
  await esperar(4000);
  ok("8: al vencer el token", motivo(corta), '{"motivo":"vencida"}');

  // 9) Latido cada 25 segundos
  await esperar(Math.max(0, 26_000 - (Date.now() - abiertaEn)));
  // (padreBis no sirve: "cerrar todas las demás" del paso 7 cerró su sesión)
  ok("9: latido", si(multiAdmin.texto().includes(": latido")), "sí");

  // 10) El navegador puede mandar el encabezado Authorization (consulta previa de CORS)
  const previa = await fetch(`${API}/api/tiempo-real`, {
    method: "OPTIONS",
    headers: { Origin: config.CORS_ORIGIN, "Access-Control-Request-Method": "GET", "Access-Control-Request-Headers": "authorization" },
  });
  ok("10: consulta previa de CORS", previa.status, 204);

  [padreBis, multiAdmin, multiProfe, cp1].forEach((c) => c.cortar());
  await limpiarMundo(prisma);
  ok("limpieza", await prisma.usuario.count({ where: { email: { startsWith: "prueba-tmp-av" } } }), 0);
  await prisma.$disconnect();
  process.exit(0);
})();
