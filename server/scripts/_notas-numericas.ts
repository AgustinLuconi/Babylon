// Solo notas numéricas: no hay escala conceptual (R/B/MB) y las notas se validan como números de 0 a 10 (cierre: 1 a 10).
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
async function pedir(metodo: string, ruta: string, token: string, cuerpo?: unknown) {
  const r = await fetch(`${API}${ruta}`, { method: metodo, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo) });
  const texto = await r.text();
  return { status: r.status, d: texto ? (JSON.parse(texto) as Record<string, unknown>) : null };
}

(async () => {
  const m = await crearMundo(prisma);
  const profe = await login("profe");
  const hoy = new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10);
  const base = { cursoId: m.cursoId, nombre: "Prueba numérica", tipo: "examen", fecha: hoy, periodo: "julio" };

  const sinEscala = await pedir("POST", "/api/calificaciones/evaluaciones", profe, base);
  ok("crear una evaluación (sin escala)", sinEscala.status, 201);
  const id = sinEscala.d?.id as string;
  ok("la evaluación no tiene escala", "escala" in (sinEscala.d ?? {}), false);
  ok("mandar una escala ya no se admite", (await pedir("POST", "/api/calificaciones/evaluaciones", profe, { ...base, escala: "numerica" })).status, 400);
  ok("ni la conceptual", (await pedir("POST", "/api/calificaciones/evaluaciones", profe, { ...base, escala: "conceptual" })).status, 400);

  const cargar = (nota: string) => pedir("POST", `/api/calificaciones/evaluaciones/${id}/calificaciones`, profe, { notas: [{ alumnoId: m.hijo1, nota }] });
  for (const mala of ["MB", "B", "R", "M", "abc", "11", "-1", "7.555"]) ok(`nota ${JSON.stringify(mala)} se rechaza`, (await cargar(mala)).status, 400);
  ok("nota 7,5 se acepta", (await cargar("7,5")).status, 201);
  ok("y se guarda con punto", (await prisma.calificacion.findFirstOrThrow({ where: { evaluacionId: id, alumnoId: m.hijo1 } })).nota, "7.5");
  ok("nota 10 se acepta", (await cargar("10")).status, 201);
  ok("nota 0 se acepta en una evaluación", (await cargar("0")).status, 201);

  const cierre = (nota: string) => pedir("POST", "/api/calificaciones/notas-cierre", profe, { notas: [{ alumnoId: m.hijo1, cursoId: m.cursoId, periodo: "julio", nota }] });
  for (const mala of ["MB", "R", "0", "11", "x"]) ok(`cierre ${JSON.stringify(mala)} se rechaza`, (await cierre(mala)).status, 400);
  ok("cierre 9 se acepta", (await cierre("9")).status, 201);
  ok("cierre 8,5 se guarda con punto", ((await cierre("8,5")).d as unknown as { nota: string }[])?.[0]?.nota, "8.5");

  await limpiarMundo(prisma);
  await prisma.$disconnect();
})();
