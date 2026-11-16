// Casilla "Justificada" de la asistencia: validación (el motivo es obligatorio y solo vale con "ausente"), guardado y
// corrección de un registro ya guardado. Requiere la API levantada en :4000 (mundo prueba-tmp-av).
import { PrismaClient } from "@prisma/client";
import { container } from "../src/container";
import { registrarAsistenciaMasivaSchema } from "../src/modules/asistencia/asistencia.schema";
import { ok } from "./_check";
import { CLAVE, crearMundo, email, limpiarMundo } from "./_mundo-avisos";

const prisma = new PrismaClient();
const API = "http://localhost:4000";

(async () => {
  const m = await crearMundo(prisma);
  try {
    const cuerpo = (fecha: string, registro: Record<string, unknown>) => ({ cursoId: m.cursoId, fecha, registros: [{ alumnoId: m.hijo1, ...registro }] });
    const valido = (fecha: string, registro: Record<string, unknown>) => registrarAsistenciaMasivaSchema.safeParse(cuerpo(fecha, registro)).success;

    ok("esquema: ausente justificada con motivo", valido("2026-01-12", { estado: "ausente", justificada: true, motivo: "Gripe" }), true);
    ok("esquema: justificada sin motivo", valido("2026-01-12", { estado: "ausente", justificada: true }), false);
    ok("esquema: justificada con motivo de puros espacios", valido("2026-01-12", { estado: "ausente", justificada: true, motivo: "   " }), false);
    ok("esquema: justificada con estado presente", valido("2026-01-12", { estado: "presente", justificada: true, motivo: "x" }), false);
    ok("esquema: justificada con estado tarde", valido("2026-01-12", { estado: "tarde", justificada: true, motivo: "x" }), false);
    ok("esquema: ausente sin la casilla (como antes)", valido("2026-01-12", { estado: "ausente" }), true);
    ok("esquema: justificada false no exige motivo", valido("2026-01-12", { estado: "ausente", justificada: false }), true);

    const guardar = (fecha: string, registro: Record<string, unknown>) =>
      container.asistenciaService.registrarAsistenciaMasiva(registrarAsistenciaMasivaSchema.parse(cuerpo(fecha, registro)), m.profesorId);
    const fila = (fecha: string) => prisma.asistencia.findFirst({ where: { alumnoId: m.hijo1, cursoId: m.cursoId, fecha: new Date(`${fecha}T00:00:00Z`) } });
    const cantidad = () => prisma.asistencia.count({ where: { alumnoId: m.hijo1, cursoId: m.cursoId } });

    await guardar("2026-01-13", { estado: "ausente", justificada: true, motivo: "Gripe" });
    ok("se guarda justificada=true con su motivo", `${(await fila("2026-01-13"))?.justificada} ${(await fila("2026-01-13"))?.motivo}`, "true Gripe");
    await guardar("2026-01-14", { estado: "ausente", motivo: "Sin avisar" });
    ok("sin la casilla queda justificada=false", (await fila("2026-01-14"))?.justificada, false);

    const antes = await cantidad();
    await guardar("2026-01-13", { estado: "presente" });
    ok("corregir la misma fecha no duplica el registro", await cantidad(), antes);
    ok("al pasar a presente, justificada vuelve a false", (await fila("2026-01-13"))?.justificada, false);
    await guardar("2026-01-14", { estado: "ausente", justificada: true, motivo: "Presentó certificado" });
    ok("se puede justificar una falta después", (await fila("2026-01-14"))?.justificada, true);

    // Registros viejos (creados sin el campo) leen justificada=false
    await prisma.asistencia.create({ data: { id: "prueba-tmp-av-asis-vieja", alumnoId: m.hijo2, cursoId: m.cursoId, fecha: new Date("2026-01-15T00:00:00Z"), estado: "ausente" } });
    const deHijo2 = await container.asistenciaService.listarPorAlumno(m.hijo2, { rol: "admin" });
    ok("un registro viejo lee justificada=false", deHijo2[0]?.justificada, false);

    // Por la API
    const login = await fetch(`${API}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: email("profe"), password: CLAVE }) });
    const token = ((await login.json()) as { token: string }).token;
    const pedir = async (c: unknown) => (await fetch(`${API}/api/asistencia/masiva`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(c) })).status;
    ok("API: justificada sin motivo → 400", await pedir(cuerpo("2026-01-16", { estado: "ausente", justificada: true })), 400);
    ok("API: justificada con estado presente → 400", await pedir(cuerpo("2026-01-16", { estado: "presente", justificada: true, motivo: "x" })), 400);
    ok("API: ausente justificada con motivo → 201", await pedir(cuerpo("2026-01-16", { estado: "ausente", justificada: true, motivo: "Viaje" })), 201);
  } catch (e) {
    ok("sin excepciones", String(e), "ninguna");
  } finally {
    await limpiarMundo(prisma);
    await prisma.$disconnect();
    process.exit(0);
  }
})();
