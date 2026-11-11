// Cada familia y cada profesor reciben solo los ids de lo suyo: nunca los de otras familias ni cantidades del instituto.
import { PrismaClient } from "@prisma/client";
import { CanalEnMemoria } from "../src/core/adapters/CanalEnMemoria";
import { PrismaUnitOfWork } from "../src/core/adapters/PrismaUnitOfWork";
import { TableroDeAnuncios } from "../src/core/eventos";
import type { Rol, SenalEnVivo } from "../src/core/ports";
import type { EventosDelSistema } from "../src/eventos";
import type { CambioDeDatos } from "../src/modules/cambios/cambio.entity";
import { PrismaDestinatariosDeCambios } from "../src/modules/cambios/cambio.destinatarios.prisma";
import { suscribirDifusionDeCambios } from "../src/modules/cambios/cambio.difusion";
import { ok } from "./_check";
import { crearMundo, limpiarMundo, P } from "./_mundo-avisos";

const prisma = new PrismaClient();
const canal = new CanalEnMemoria(async () => true);
const tablero = new TableroDeAnuncios<EventosDelSistema>();
const uow = new PrismaUnitOfWork(prisma);
const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));
let n = 0;
const conectar = (usuarioId: string, rol: Rol) => {
  const recibidas: { ids: Record<string, string[]> }[] = [];
  canal.registrar({ sesionId: `s${++n}`, usuarioId, rol, enviar: (s: SenalEnVivo) => void (s.tipo === "cambio" && recibidas.push(s.datos as never)), cerrar: () => {} });
  return recibidas;
};
const corto = (id: string) => id.replace(`${P}-`, "");
const ids = (r: { ids: Record<string, string[]> }[]) => {
  const ultimo = r.at(-1);
  if (!ultimo) return "nada";
  return Object.entries(ultimo.ids)
    .filter(([, v]) => v.length > 0)
    .map(([k, v]) => `${k}=${v.map(corto).sort().join("+")}`)
    .sort()
    .join(" ");
};

(async () => {
  const m = await crearMundo(prisma);
  suscribirDifusionDeCambios(tablero, canal, new PrismaDestinatariosDeCambios(prisma), async () => "Alguien");
  for (const [id, alumnoId] of [["q1", m.hijo1], ["q2", m.alumnoAjeno]] as const) {
    await prisma.cuota.create({ data: { id: `${P}-${id}`, alumnoId, mes: 9, anio: 2026, montoBase: 1, descuento: 0, montoFinal: 1, vencimiento: new Date("2026-09-10T00:00:00Z"), estado: "vencida" } });
  }
  const obs = await prisma.observacion.create({ data: { id: `${P}-obs`, alumnoId: m.alumnoAjeno, emisorId: m.admin, emisorRol: "admin", fecha: new Date(), texto: "x", categoria: "academico" } });
  const ev = await prisma.evaluacion.create({ data: { id: `${P}-ev`, cursoId: m.cursoId, nombre: "x", tipo: "examen", fecha: new Date(), periodo: "noviembre", estado: "publicada" } });
  const admin = conectar(m.admin, "admin");
  const padre = conectar(m.padre, "padre");
  const ajeno = conectar(m.ajeno, "padre");
  const profe = conectar(m.profe, "profesor");
  const multi = conectar(m.multi, "profesor");
  const secre = conectar(m.secre, "secretario");
  const publicar = async (c: CambioDeDatos) => {
    await uow.runInTransaction((tx) => tablero.publicar("datos.cambiaron", c, tx));
    await esperar(400);
  };

  await publicar({ dato: "cuotas", accion: "vencimiento", ids: { alumnoIds: [m.hijo1, m.alumnoAjeno], cuotaIds: [`${P}-q1`, `${P}-q2`] } });
  ok("vencimiento: el instituto ve todo", ids(admin), "alumnoIds=alumno-ajeno+hijo1 cuotaIds=q1+q2");
  ok("vencimiento: cada familia solo lo suyo", ids(padre), "alumnoIds=hijo1 cuotaIds=q1");
  ok("vencimiento: la otra familia solo lo suyo", ids(ajeno), "alumnoIds=alumno-ajeno cuotaIds=q2");

  await publicar({ dato: "notas-cierre", accion: "publicacion", ids: { alumnoIds: [m.hijo1, m.hijo2, m.alumnoAjeno], cursoIds: [m.cursoId, m.cursoMultiId] } });
  ok("cierre: la familia solo sus hijos y su curso", ids(padre), "alumnoIds=hijo1+hijo2 cursoIds=curso");
  ok("cierre: el profesor solo su curso", ids(profe), "alumnoIds=hijo1+hijo2 cursoIds=curso");
  ok("cierre: el otro profesor solo el suyo", ids(multi), "alumnoIds=alumno-ajeno cursoIds=curso-multi");

  await publicar({ dato: "calificaciones", accion: "carga", ids: { alumnoIds: [m.hijo1, m.hijo2], cursoIds: [m.cursoId], evaluacionIds: [ev.id] }, visibleParaFamilias: true });
  ok("notas: la familia ve la evaluación de su curso", ids(padre), "alumnoIds=hijo1+hijo2 cursoIds=curso evaluacionIds=ev");

  await publicar({ dato: "cursos", accion: "edicion", ids: { cursoIds: [m.cursoId], profesorIds: [m.profesorId, m.profesorMultiId] } });
  ok("curso reasignado: la familia no recibe ids de profesores", ids(padre), "cursoIds=curso");
  ok("curso reasignado: el profesor anterior solo su propio id", ids(profe), "cursoIds=curso profesorIds=profe");
  ok("curso reasignado: el nuevo recibe el curso", ids(multi), "cursoIds=curso profesorIds=multi");

  const antes = padre.length;
  await publicar({ dato: "observaciones", accion: "alta", ids: { alumnoIds: [m.alumnoAjeno], observacionIds: [obs.id] } });
  ok("observación de otro alumno: la familia no recibe nada", padre.length, antes);
  ok("observación: el profesor del alumno sí", ids(multi), "alumnoIds=alumno-ajeno observacionIds=obs");

  const antesSecre = secre.length;
  await publicar({ dato: "profesores", accion: "edicion", ids: { profesorIds: [m.profesorId] } });
  ok("docentes: a secretaría no le llega (no puede leer docentes)", secre.length, antesSecre);
  ok("docentes: al administrador sí", ids(admin), "profesorIds=profe");
  const antesPadre = padre.length;
  await publicar({ dato: "ciclos", accion: "alta", ids: { cicloIds: [m.cicloId] } });
  ok("alta de ciclo: a las familias no les llega", padre.length, antesPadre);
  ok("alta de ciclo: al profesor sí", profe.length > 0 && ids(profe).startsWith("cicloIds=") ? "sí" : "no", "sí");

  await limpiarMundo(prisma);
  ok("limpieza", await prisma.usuario.count({ where: { id: { startsWith: P } } }), 0);
  await prisma.$disconnect();
  process.exit(0);
})();
