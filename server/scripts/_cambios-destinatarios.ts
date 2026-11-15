import { PrismaClient } from "@prisma/client";
import { PrismaDestinatariosDeCambios } from "../src/modules/cambios/cambio.destinatarios.prisma";
import type { CambioDeDatos } from "../src/modules/cambios/cambio.entity";
import { ok } from "./_check";
import { crearMundo, limpiarMundo, P } from "./_mundo-avisos";

const prisma = new PrismaClient();
const destinatarios = new PrismaDestinatariosDeCambios(prisma);
const corto = (id: string) => id.replace(`${P}-`, "");
async function a(c: CambioDeDatos): Promise<string> {
  const r = await destinatarios.resolver(c);
  return [...[...r.roles].sort(), ...r.cuentas.map((x) => `${corto(x.usuarioId)}:${x.rol}`).sort()].join(",");
}

(async () => {
  const m = await crearMundo(prisma);
  const staff = "admin,secretario";
  ok("cuotas: cobro", await a({ dato: "cuotas", accion: "cobro", ids: { alumnoIds: [m.hijo1], cuotaIds: ["c1"] } }), `${staff},padre:padre`);
  ok("alumnos: cambio de curso, los dos profesores", await a({ dato: "alumnos", accion: "cambio-curso", ids: { alumnoIds: [m.hijo1], cursoIds: [m.cursoId, m.cursoMultiId] } }), `${staff},multi:profesor,padre:padre,profe:profesor`);
  ok("evaluaciones: alta, sin familias", await a({ dato: "evaluaciones", accion: "alta", ids: { cursoIds: [m.cursoId], evaluacionIds: ["e1"] } }), `${staff},profe:profesor`);
  ok("evaluaciones: publicación, con familias del curso", await a({ dato: "evaluaciones", accion: "publicacion", ids: { cursoIds: [m.cursoId], evaluacionIds: ["e1"] } }), `${staff},padre:padre,profe:profesor`);
  ok("calificaciones en borrador, sin familias", await a({ dato: "calificaciones", accion: "carga", ids: { cursoIds: [m.cursoId], evaluacionIds: ["e1"], alumnoIds: [m.hijo1] }, visibleParaFamilias: false }), `${staff},profe:profesor`);
  ok("calificaciones publicadas, con la familia", await a({ dato: "calificaciones", accion: "carga", ids: { cursoIds: [m.cursoId], evaluacionIds: ["e1"], alumnoIds: [m.hijo1] }, visibleParaFamilias: true }), `${staff},padre:padre,profe:profesor`);
  ok("notas de cierre: carga, sin familias", await a({ dato: "notas-cierre", accion: "carga", ids: { cursoIds: [m.cursoId], alumnoIds: [m.hijo1] } }), `${staff},profe:profesor`);
  ok("notas de cierre: publicación, con familias", await a({ dato: "notas-cierre", accion: "publicacion", ids: { cursoIds: [m.cursoId], alumnoIds: [m.hijo1] } }), `${staff},padre:padre,profe:profesor`);
  ok("asistencia", await a({ dato: "asistencia", accion: "registro", ids: { cursoIds: [m.cursoId], alumnoIds: [m.hijo1] } }), `${staff},padre:padre,profe:profesor`);
  ok("observación de un alumno de otro curso", await a({ dato: "observaciones", accion: "alta", ids: { alumnoIds: [m.alumnoAjeno], observacionIds: ["o1"] } }), `${staff},ajeno:padre,multi:profesor`);
  ok("categorías", await a({ dato: "categorias", accion: "alta", ids: { cursoIds: [m.cursoId] } }), `${staff},profe:profesor`);
  ok("documentos", await a({ dato: "documentos", accion: "carga", ids: { alumnoIds: [m.hijo1] } }), `${staff},padre:padre`);
  ok("cursos: edición con cambio de profesor", await a({ dato: "cursos", accion: "edicion", ids: { cursoIds: [m.cursoId], profesorIds: [m.profesorId, m.profesorMultiId] } }), `${staff},multi:profesor,padre:padre,profe:profesor`);
  ok("padres", await a({ dato: "padres", accion: "edicion", ids: { padreIds: [m.padreId] } }), staff);
  ok("profesores: solo administración (secretaría no puede leer docentes)", await a({ dato: "profesores", accion: "edicion", ids: { profesorIds: [m.profesorId] } }), "admin");
  ok("alta de ciclo: sin familias (no pueden leer ciclos)", await a({ dato: "ciclos", accion: "alta", ids: { cicloIds: [m.cicloId] } }), "admin,profesor,secretario");
  ok("usuarios: solo administración", await a({ dato: "usuarios", accion: "alta", ids: { usuarioIds: [m.secre] } }), "admin");
  ok("configuración", await a({ dato: "configuracion", accion: "edicion", ids: {} }), staff);
  ok("ciclos: todos los roles", await a({ dato: "ciclos", accion: "activacion", ids: { cicloIds: [m.cicloId] } }), "admin,padre,profesor,secretario");
  ok("sesiones: la propia cuenta en todos sus roles", await a({ dato: "sesiones", accion: "inicio", ids: { usuarioIds: [m.multi] } }), "multi:admin,multi:profesor");
  // Tras un pase de año el curso actual del alumno es otro: los profesores de los dos cursos (por inscripción) siguen enterándose.
  await prisma.ciclo.create({ data: { id: `${P}-ciclo-2098`, anio: 2098, activo: false } });
  await prisma.inscripcion.create({ data: { id: `${P}-h1-i98`, alumnoId: m.hijo1, cursoId: m.cursoMultiId, cicloId: `${P}-ciclo-2098`, fecha: new Date(), aplicaDescuentoHermanos: false } });
  await prisma.alumno.update({ where: { id: m.hijo1 }, data: { cursoId: m.cursoMultiId } });
  ok("observación de un alumno que pasó de curso: los profesores de sus dos cursos", await a({ dato: "observaciones", accion: "alta", ids: { alumnoIds: [m.hijo1], observacionIds: ["o1"] } }), `${staff},multi:profesor,padre:padre,profe:profesor`);
  const r = await destinatarios.resolver({ dato: "asistencia", accion: "registro", ids: { cursoIds: [m.cursoId], alumnoIds: [m.hijo1] } });
  ok("asistencia del curso viejo: su profesor recibe al alumno que ya está en otro curso", r.cuentas.find((x) => x.usuarioId === m.profe)?.ids.alumnoIds?.includes(m.hijo1) ?? false, true);
  ok("asistencia del curso viejo: la familia de un alumno inscripto en él también", r.cuentas.some((x) => x.usuarioId === m.padre), true);
  await prisma.usuario.update({ where: { id: m.padre }, data: { estado: "inactivo" } });
  ok("una cuenta inactiva no recibe nada", await a({ dato: "cuotas", accion: "cobro", ids: { alumnoIds: [m.hijo1] } }), staff);
  await limpiarMundo(prisma);
  ok("limpieza", await prisma.usuario.count({ where: { id: { startsWith: P } } }), 0);
  await prisma.$disconnect();
})();
