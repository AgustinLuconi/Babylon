import type { PrismaClient } from "@prisma/client";
import { fechaHoraEnArgentina, inicioDeHoyUtc } from "../../core/fechas";

// Avisos de la campana: se derivan del estado actual (algo pendiente o vencido
// que hay que atender), no de un historial de eventos — no existe "leído". Igual
// que reportes/, es una composición de lectura sobre otros módulos, así que
// consulta Prisma directo. Todo "hoy" se calcula en hora de Argentina.

export type TonoNotificacion = "danger" | "warning" | "info";

export interface Notificacion {
  id: string;
  tono: TonoNotificacion;
  texto: string;
  ruta: string;
}

const MAX_NOTIFICACIONES = 10;
const DIA_MS = 24 * 60 * 60 * 1000;
const DIAS_AVISO_VENCIMIENTO = 5;
const DIAS_NOVEDADES = 7;
const ORDEN_TONO: Record<TonoNotificacion, number> = { danger: 0, warning: 1, info: 2 };
const DIAS_SEMANA = ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"] as const;
const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const PERIODOS: Record<string, string> = { julio: "1° Cierre", noviembre: "2° Cierre" };

const formatMonto = (monto: number) => `$${monto.toLocaleString("es-AR")}`;
const formatDiaMes = (fecha: Date) => `${String(fecha.getUTCDate()).padStart(2, "0")}/${String(fecha.getUTCMonth() + 1).padStart(2, "0")}`;

function ordenar(lista: Notificacion[]): Notificacion[] {
  return lista.sort((a, b) => ORDEN_TONO[a.tono] - ORDEN_TONO[b.tono]).slice(0, MAX_NOTIFICACIONES);
}

export class NotificacionService {
  constructor(private readonly prisma: PrismaClient) {}

  // Admin/Secretario. Son los mismos avisos que muestra el resumen del panel (cuotas más
  // atrasadas, documentación pendiente, próximas evaluaciones), pero con consultas
  // livianas: el resumen completo recorre todas las cuotas, pagos y asistencias.
  async listarParaStaff(): Promise<Notificacion[]> {
    const [vencidas, sinAutorizacionDeImagen, proximasEvaluaciones] = await Promise.all([
      // Las más atrasadas son las de vencimiento más antiguo.
      this.prisma.cuota.findMany({
        where: { estado: "vencida" },
        // `id` desempata las que vencen el mismo día, para que los avisos sean estables entre consultas.
        orderBy: [{ vencimiento: "asc" }, { id: "asc" }],
        take: 5,
        include: { alumno: true },
      }),
      this.prisma.alumno.count({
        where: { documentos: { none: { tipo: "autorizacion_imagen", estado: "autorizado" } } },
      }),
      // `fecha` es medianoche UTC (fecha calendario): se compara contra el inicio del día argentino.
      this.prisma.evaluacion.findMany({
        where: { fecha: { gte: inicioDeHoyUtc() } },
        orderBy: { fecha: "asc" },
        take: 3,
        include: { curso: true },
      }),
    ]);

    const lista: Notificacion[] = vencidas.map((c) => ({
      id: `cuota-${c.alumnoId}-${c.mes}-${c.anio}`,
      tono: "danger",
      texto: `Cuota vencida: ${c.alumno.nombre} ${c.alumno.apellido} — ${formatMonto(c.montoFinal)}`,
      ruta: "/cuotas",
    }));
    if (sinAutorizacionDeImagen > 0) {
      lista.push({
        id: "documentacion-pendiente",
        tono: "warning",
        texto: `${sinAutorizacionDeImagen} alumno${sinAutorizacionDeImagen !== 1 ? "s" : ""} con autorización de imagen pendiente`,
        ruta: "/alumnos",
      });
    }
    for (const e of proximasEvaluaciones) {
      lista.push({ id: `evaluacion-${e.id}`, tono: "info", texto: `Evaluación próxima: ${e.nombre} — ${e.curso.nombre}`, ruta: "/reportes" });
    }
    return ordenar(lista);
  }

  async listarParaProfesor(profesorId: string, ahora: Date = new Date()): Promise<Notificacion[]> {
    const cursos = await this.prisma.curso.findMany({
      where: { profesorId, estado: "activo", ciclo: { activo: true } },
      include: { horarios: true },
    });
    const nombreCurso = new Map(cursos.map((c) => [c.id, c.nombre]));
    const cursoIds = cursos.map((c) => c.id);
    const lista: Notificacion[] = [];

    // Clase de hoy (hora de Argentina) que ya empezó y no tiene asistencia.
    const { hora, minuto } = fechaHoraEnArgentina(ahora);
    const ahoraHHMM = `${String(hora).padStart(2, "0")}:${String(minuto).padStart(2, "0")}`;
    const hoy = inicioDeHoyUtc(ahora);
    const diaSemana = DIAS_SEMANA[hoy.getUTCDay()];
    for (const curso of cursos) {
      const clase = curso.horarios.find((h) => h.diaSemana === diaSemana && h.horaInicio <= ahoraHHMM);
      if (!clase) continue;
      const tomada = await this.prisma.asistencia.count({
        where: { cursoId: curso.id, fecha: { gte: hoy, lt: new Date(hoy.getTime() + DIA_MS) } },
      });
      if (tomada === 0) {
        lista.push({ id: `asistencia-${curso.id}`, tono: "warning", texto: `Falta tomar asistencia de ${curso.nombre} (hoy ${clase.horaInicio})`, ruta: "/asistencia" });
      }
    }

    // Evaluaciones con notas cargadas que siguen en borrador.
    const evaluaciones = await this.prisma.evaluacion.findMany({
      where: { cursoId: { in: cursoIds }, estado: "borrador", calificaciones: { some: {} } },
    });
    for (const e of evaluaciones) {
      lista.push({ id: `evaluacion-borrador-${e.id}`, tono: "info", texto: `"${e.nombre}" (${nombreCurso.get(e.cursoId)}) tiene notas cargadas y sigue sin publicar`, ruta: "/calificaciones" });
    }

    // Notas de cierre en borrador, una por curso y período.
    const cierres = await this.prisma.notaCierre.groupBy({
      by: ["cursoId", "periodo"],
      where: { cursoId: { in: cursoIds }, estado: "borrador" },
    });
    for (const c of cierres) {
      lista.push({ id: `cierre-${c.cursoId}-${c.periodo}`, tono: "info", texto: `Notas de cierre de ${nombreCurso.get(c.cursoId)} (${PERIODOS[c.periodo] ?? c.periodo}) en borrador`, ruta: "/calificaciones" });
    }
    return ordenar(lista);
  }

  async listarParaPadre(padreId: string, ahora: Date = new Date()): Promise<Notificacion[]> {
    const hijos = await this.prisma.alumno.findMany({ where: { padreId, estado: "activo" }, select: { id: true, nombre: true } });
    const nombreHijo = new Map(hijos.map((h) => [h.id, h.nombre]));
    const ids = hijos.map((h) => h.id);
    const hoy = inicioDeHoyUtc(ahora);
    const desde = new Date(ahora.getTime() - DIAS_NOVEDADES * DIA_MS);
    const lista: Notificacion[] = [];

    const cuotas = await this.prisma.cuota.findMany({ where: { alumnoId: { in: ids }, estado: { in: ["vencida", "pendiente"] } } });
    for (const c of cuotas) {
      const mes = `${MESES[c.mes - 1]} ${c.anio}`;
      if (c.estado === "vencida") {
        lista.push({ id: `cuota-${c.id}`, tono: "danger", texto: `Cuota de ${mes} de ${nombreHijo.get(c.alumnoId)} vencida — ${formatMonto(c.montoFinal)}`, ruta: "/mis-hijos/cuotas" });
        continue;
      }
      const dias = Math.round((c.vencimiento.getTime() - hoy.getTime()) / DIA_MS);
      if (dias >= 0 && dias <= DIAS_AVISO_VENCIMIENTO) {
        lista.push({ id: `cuota-${c.id}`, tono: "warning", texto: `La cuota de ${mes} de ${nombreHijo.get(c.alumnoId)} vence el ${formatDiaMes(c.vencimiento)}`, ruta: "/mis-hijos/cuotas" });
      }
    }

    const conDocPendiente = await this.prisma.documento.findMany({
      where: { alumnoId: { in: ids }, estado: "pendiente" },
      distinct: ["alumnoId"],
      select: { alumnoId: true },
    });
    for (const d of conDocPendiente) {
      lista.push({ id: `documentacion-${d.alumnoId}`, tono: "warning", texto: `${nombreHijo.get(d.alumnoId)} tiene documentación pendiente`, ruta: "/mis-hijos/documentacion" });
    }

    // Novedades de los últimos 7 días. Nunca borradores: solo lo publicado.
    const evaluaciones = await this.prisma.evaluacion.findMany({
      where: { estado: "publicada", publicadaEn: { gte: desde }, calificaciones: { some: { alumnoId: { in: ids } } } },
      include: { calificaciones: { where: { alumnoId: { in: ids } }, select: { alumnoId: true } } },
    });
    for (const e of evaluaciones) {
      for (const cal of e.calificaciones) {
        lista.push({ id: `nota-${e.id}-${cal.alumnoId}`, tono: "info", texto: `Nueva nota de ${nombreHijo.get(cal.alumnoId)}: ${e.nombre}`, ruta: "/mis-hijos/calificaciones" });
      }
    }
    const cierres = await this.prisma.notaCierre.findMany({ where: { alumnoId: { in: ids }, estado: "publicada", publicadaEn: { gte: desde } } });
    for (const c of cierres) {
      lista.push({ id: `cierre-${c.id}`, tono: "info", texto: `Nota de cierre (${PERIODOS[c.periodo] ?? c.periodo}) de ${nombreHijo.get(c.alumnoId)} publicada`, ruta: "/mis-hijos/calificaciones" });
    }
    const observaciones = await this.prisma.observacion.findMany({ where: { alumnoId: { in: ids }, fecha: { gte: desde } } });
    for (const o of observaciones) {
      lista.push({ id: `observacion-${o.id}`, tono: "info", texto: `Nueva observación sobre ${nombreHijo.get(o.alumnoId)}`, ruta: "/mis-hijos" });
    }
    return ordenar(lista);
  }
}
