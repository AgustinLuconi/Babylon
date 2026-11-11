// La nómina que ve el profesor (pantallas de carga) tiene solo alumnos activos: un alumno dado de baja deja de aparecer.
// Administración y secretaría siguen viendo la nómina completa.
import { PrismaClient } from "@prisma/client";
import { ok } from "./_check";
import { crearMundo, limpiarMundo } from "./_mundo-avisos";

const prisma = new PrismaClient();
(async () => {
  const m = await crearMundo(prisma);
  await prisma.alumno.update({ where: { id: m.hijo2 }, data: { estado: "inactivo" } });
  const r = await fetch("http://localhost:4000/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: "prueba-tmp-av-profe@prueba.babylon.test", password: "prueba1234" }) });
  const { token } = (await r.json()) as { token: string };
  const nomina = (await (await fetch(`http://localhost:4000/api/cursos/${m.cursoId}/alumnos`, { headers: { Authorization: `Bearer ${token}` } })).json()) as { id: string }[];
  ok("el profesor no ve al alumno dado de baja", nomina.map((a) => a.id.replace("prueba-tmp-av-", "")).sort().join(","), "hijo1");
  const r2 = await fetch("http://localhost:4000/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: "prueba-tmp-av-admin@prueba.babylon.test", password: "prueba1234" }) });
  const admin = ((await r2.json()) as { token: string }).token;
  const completa = (await (await fetch(`http://localhost:4000/api/cursos/${m.cursoId}/alumnos`, { headers: { Authorization: `Bearer ${admin}` } })).json()) as { id: string }[];
  ok("administración ve la nómina completa", completa.length, 2);
  await limpiarMundo(prisma);
  await prisma.$disconnect();
  process.exit(0);
})();
