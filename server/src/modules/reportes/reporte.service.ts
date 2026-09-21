import type { PrismaClient } from "@prisma/client";
import { EntityNotFoundError } from "../../core/errors";

export interface CuotaVencidaResumen {
  alumnoId: string;
  alumnoNombre: string;
  cursoNombre: string | null;
  cursoNivel: string | null;
  mes: number;
  anio: number;
  monto: number;
  diasVencido: number;
}

export interface EvaluacionProximaResumen {
  evaluacionId: string;
  nombre: string;
  tipo: string;
  fecha: Date;
  cursoNombre: string;
  cursoNivel: string;
  profesorNombre: string;
}

export interface ActividadResumen {
  tipo: "enrollment" | "payment" | "observation";
  actor: string;
  verbo: string;
  objetivo: string;
  fecha: Date;
}

const NOMBRES_MES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

function inicioDeHoyUtc(): Date {
  const ahora = new Date();
  return new Date(Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth(), ahora.getUTCDate()));
}

const CATEGORIA_LABELS: Record<string, string> = {
  academico: "Académico",
  comportamiento: "Comportamiento",
  felicitacion: "Felicitación",
  administrativo: "Administrativo",
};

export interface ReporteAlumnoResumen {
  alumnoId: string;
  alumnoNombre: string;
  cursoNombre: string | null;
  cursoNivel: string | null;
  promedioJulio: number | null;
  promedioNoviembre: number | null;
  notaCierreJulio: { nota: number | null; estado: string } | null;
  notaCierreNoviembre: { nota: number | null; estado: string } | null;
  asistenciaPct: number | null;
  cuotasPagas: number;
  cuotasVencidas: number;
  deudaTotal: number;
  montoPagadoTotal: number;
  ultimoPago: { mes: number; anio: number } | null;
}

// Comparación mes actual vs. mes anterior para los KPIs del dashboard. Es
// `null` cuando el ciclo consultado no es el año en curso: "este mes" y "el
// mes pasado" no significan nada para un ciclo histórico.
export interface TendenciasDashboard {
  mesAnteriorNombre: string;
  alumnosNuevosMes: number;
  // Diferencia en puntos porcentuales entre el % del mes actual y el del mes
  // anterior. `null` si alguno de los dos meses no tiene datos para comparar.
  cuotasAlDiaVariacionPp: number | null;
  asistenciaVariacionPp: number | null;
}

export interface ResumenDashboard {
  alumnosActivos: number;
  cuotasAlDiaPct: number;
  asistenciaPromedioPct: number;
  cursosActivos: number;
  docentesCount: number;
  nivelesCount: number;
  cuotasVencidas: CuotaVencidaResumen[];
  proximasEvaluaciones: EvaluacionProximaResumen[];
  composicionPorNivel: Record<string, number>;
  actividadReciente: ActividadResumen[];
  cobradoHoyMonto: number;
  cobradoHoyCount: number;
  documentacionPendienteCount: number;
  tendencias: TendenciasDashboard | null;
}

interface ContextoCiclo {
  anio: number;
  alumnoIds: Set<string>;
  cursoPorAlumno: Map<string, { id: string; nombre: string; nivel: string }>;
}

// Módulo sin entidad propia (ver CLAUDE.md, "Alta de Secretario", mismo
// criterio): "reportes" es una composición de lectura sobre datos de otros
// módulos, no un agregado de dominio — consulta Prisma directo en vez de
// pasar por cada repository, porque no hay ninguna regla de negocio acá.
export class ReporteService {
  constructor(private readonly prisma: PrismaClient) {}

  // `cicloId` es opcional en los dos métodos públicos: sin él, se comporta
  // exactamente como antes de que existiera el concepto de Ciclo (todos los
  // datos, sin filtrar) — no rompe a nadie que ya llamaba a estos endpoints.
  // Con él, arma el contexto una sola vez (vía Inscripcion, el historial
  // real de qué curso tuvo cada alumno en cada ciclo — no `Alumno.cursoId`,
  // que siempre refleja el curso ACTUAL y puede ser de otro ciclo).
  private async resolverContextoCiclo(cicloId?: string): Promise<ContextoCiclo | null> {
    if (!cicloId) return null;
    const ciclo = await this.prisma.ciclo.findUnique({ where: { id: cicloId } });
    if (!ciclo) {
      throw new EntityNotFoundError("Ciclo", cicloId);
    }
    const inscripciones = await this.prisma.inscripcion.findMany({
      where: { cicloId },
      include: { curso: true },
    });
    return {
      anio: ciclo.anio,
      alumnoIds: new Set(inscripciones.map((i) => i.alumnoId)),
      cursoPorAlumno: new Map(inscripciones.map((i) => [i.alumnoId, i.curso])),
    };
  }

  async obtenerResumenDashboard(cicloId?: string): Promise<ResumenDashboard> {
    const contexto = await this.resolverContextoCiclo(cicloId);
    const alumnoIdsFiltro = contexto ? Array.from(contexto.alumnoIds) : undefined;

    const [alumnosRaw, cuotas, asistencias, cursos, evaluaciones, pagos, observacionesRecientes, documentosImagen] =
      await Promise.all([
        this.prisma.alumno.findMany({
          where: alumnoIdsFiltro ? { id: { in: alumnoIdsFiltro } } : undefined,
          include: { curso: true },
        }),
        this.prisma.cuota.findMany({
          where: {
            ...(alumnoIdsFiltro ? { alumnoId: { in: alumnoIdsFiltro } } : {}),
            ...(contexto ? { anio: contexto.anio } : {}),
          },
          include: { alumno: { include: { curso: true } } },
        }),
        this.prisma.asistencia.findMany({
          where: cicloId ? { curso: { cicloId } } : undefined,
          select: { estado: true, fecha: true },
        }),
        this.prisma.curso.findMany({
          where: cicloId ? { cicloId } : undefined,
          include: { profesor: true },
        }),
        this.prisma.evaluacion.findMany({
          // `fecha` se guarda como medianoche UTC (fecha calendario sin hora) —
          // comparar contra el inicio del día en UTC, no en huso horario local,
          // para no excluir evaluaciones de "hoy" por unas horas de diferencia.
          where: {
            fecha: { gte: inicioDeHoyUtc() },
            ...(cicloId ? { curso: { cicloId } } : {}),
          },
          orderBy: { fecha: "asc" },
          take: 5,
          include: { curso: { include: { profesor: true } } },
        }),
        this.prisma.pago.findMany({
          where: alumnoIdsFiltro ? { cuota: { alumnoId: { in: alumnoIdsFiltro } } } : undefined,
          orderBy: { fechaPago: "desc" },
          include: { cuota: { include: { alumno: true } } },
        }),
        this.prisma.observacion.findMany({
          where: {
            ...(alumnoIdsFiltro ? { alumnoId: { in: alumnoIdsFiltro } } : {}),
            ...(contexto
              ? { fecha: { gte: new Date(Date.UTC(contexto.anio, 0, 1)), lt: new Date(Date.UTC(contexto.anio + 1, 0, 1)) } }
              : {}),
          },
          orderBy: { fecha: "desc" },
          take: 5,
          include: { alumno: true },
        }),
        this.prisma.documento.findMany({
          where: {
            tipo: "autorizacion_imagen",
            ...(alumnoIdsFiltro ? { alumnoId: { in: alumnoIdsFiltro } } : {}),
          },
        }),
      ]);
    const pagosRecientes = pagos.slice(0, 5);

    // Para el ciclo consultado, el curso "de ese año" es el de la
    // Inscripcion, no el actual del alumno (que puede haber cambiado desde
    // entonces si ya se reinscribió en un ciclo posterior).
    const alumnos = alumnosRaw.map((a) => ({
      ...a,
      curso: contexto?.cursoPorAlumno.get(a.id) ?? a.curso,
    }));

    const categoriasPersonalizadasUsadas = observacionesRecientes
      .map((o) => o.categoria)
      .filter((c) => !CATEGORIA_LABELS[c]);
    const categoriasPersonalizadas =
      categoriasPersonalizadasUsadas.length > 0
        ? await this.prisma.categoriaPersonalizada.findMany({ where: { id: { in: categoriasPersonalizadasUsadas } } })
        : [];
    const nombreCategoriaPersonalizada = new Map(categoriasPersonalizadas.map((c) => [c.id, c.nombre]));
    const resolverCategoria = (categoria: string) =>
      CATEGORIA_LABELS[categoria] ?? nombreCategoriaPersonalizada.get(categoria) ?? categoria;

    const alumnosActivos = alumnos.filter((a) => a.estado === "activo").length;

    const cuotasPagadas = cuotas.filter((c) => c.estado === "pagada").length;
    const cuotasAlDiaPct = cuotas.length > 0 ? Math.round((cuotasPagadas / cuotas.length) * 100) : 100;

    const presentes = asistencias.filter((a) => a.estado === "presente" || a.estado === "tarde").length;
    const asistenciaPromedioPct = asistencias.length > 0 ? Math.round((presentes / asistencias.length) * 100) : 0;

    const cursosActivos = cursos.filter((c) => c.estado === "activo").length;
    const docentesCount = new Set(cursos.map((c) => c.profesorId)).size;
    const nivelesCount = new Set(cursos.map((c) => c.nivel)).size;

    const ahora = new Date();
    const cuotasVencidas: CuotaVencidaResumen[] = cuotas
      .filter((c) => c.estado === "vencida")
      .map((c) => ({
        alumnoId: c.alumno.id,
        alumnoNombre: `${c.alumno.nombre} ${c.alumno.apellido}`,
        cursoNombre: c.alumno.curso?.nombre ?? null,
        cursoNivel: c.alumno.curso?.nivel ?? null,
        mes: c.mes,
        anio: c.anio,
        monto: c.montoFinal,
        diasVencido: Math.max(0, Math.floor((ahora.getTime() - c.vencimiento.getTime()) / (1000 * 60 * 60 * 24))),
      }))
      .sort((a, b) => b.diasVencido - a.diasVencido)
      .slice(0, 8);

    const proximasEvaluaciones: EvaluacionProximaResumen[] = evaluaciones.map((e) => ({
      evaluacionId: e.id,
      nombre: e.nombre,
      tipo: e.tipo,
      fecha: e.fecha,
      cursoNombre: e.curso.nombre,
      cursoNivel: e.curso.nivel,
      profesorNombre: `${e.curso.profesor.nombre} ${e.curso.profesor.apellido ?? ""}`.trim(),
    }));

    const composicionPorNivel: Record<string, number> = {};
    for (const alumno of alumnos) {
      if (!alumno.curso) continue;
      composicionPorNivel[alumno.curso.nivel] = (composicionPorNivel[alumno.curso.nivel] ?? 0) + 1;
    }

    const actividadReciente: ActividadResumen[] = [
      ...alumnos
        .slice()
        .sort((a, b) => b.fechaInscripcion.getTime() - a.fechaInscripcion.getTime())
        .slice(0, 5)
        .map((a): ActividadResumen => ({
          tipo: "enrollment",
          actor: `${a.nombre} ${a.apellido}`,
          verbo: "fue inscripto/a",
          objetivo: a.curso?.nombre ?? "sin curso asignado",
          fecha: a.fechaInscripcion,
        })),
      ...pagosRecientes.map(
        (p): ActividadResumen => ({
          tipo: "payment",
          actor: `${p.cuota.alumno.nombre} ${p.cuota.alumno.apellido}`,
          verbo: "pagó la cuota de",
          objetivo: `${p.cuota.mes}/${p.cuota.anio}`,
          fecha: p.fechaPago,
        }),
      ),
      ...observacionesRecientes.map(
        (o): ActividadResumen => ({
          tipo: "observation",
          actor: `${o.alumno.nombre} ${o.alumno.apellido}`,
          verbo: "recibió una observación",
          objetivo: resolverCategoria(o.categoria),
          fecha: o.fecha,
        }),
      ),
    ]
      .sort((a, b) => b.fecha.getTime() - a.fecha.getTime())
      .slice(0, 10);

    const inicioHoy = inicioDeHoyUtc();
    const pagosHoy = pagos.filter((p) => p.fechaPago >= inicioHoy);
    const cobradoHoyMonto = pagosHoy.reduce((a, p) => a + p.monto, 0);
    const cobradoHoyCount = pagosHoy.length;

    const alumnosConImagenAutorizada = new Set(
      documentosImagen.filter((d) => d.estado === "autorizado").map((d) => d.alumnoId),
    );
    const documentacionPendienteCount = alumnos.filter((a) => !alumnosConImagenAutorizada.has(a.id)).length;

    return {
      tendencias: this.calcularTendencias(contexto?.anio, alumnos, cuotas, asistencias),
      alumnosActivos,
      cuotasAlDiaPct,
      asistenciaPromedioPct,
      cursosActivos,
      docentesCount,
      nivelesCount,
      cuotasVencidas,
      proximasEvaluaciones,
      composicionPorNivel,
      actividadReciente,
      cobradoHoyMonto,
      cobradoHoyCount,
      documentacionPendienteCount,
    };
  }

  // "Este mes" es el mes calendario LOCAL de hoy; las fechas guardadas son
  // fechas calendario (medianoche UTC), por eso se leen con getUTC*.
  private calcularTendencias(
    anioCiclo: number | undefined,
    alumnos: { fechaInscripcion: Date }[],
    cuotas: { mes: number; anio: number; estado: string }[],
    asistencias: { estado: string; fecha: Date }[],
  ): TendenciasDashboard | null {
    const hoy = new Date();
    const anioActual = hoy.getFullYear();
    const mesActual = hoy.getMonth() + 1;
    if (anioCiclo !== undefined && anioCiclo !== anioActual) return null;

    const anioAnterior = mesActual === 1 ? anioActual - 1 : anioActual;
    const mesAnterior = mesActual === 1 ? 12 : mesActual - 1;

    const pctCuotasAlDia = (mes: number, anio: number): number | null => {
      const delMes = cuotas.filter((c) => c.mes === mes && c.anio === anio);
      if (delMes.length === 0) return null;
      return Math.round((delMes.filter((c) => c.estado === "pagada").length / delMes.length) * 100);
    };
    const pctAsistencia = (mes: number, anio: number): number | null => {
      const delMes = asistencias.filter((a) => a.fecha.getUTCMonth() + 1 === mes && a.fecha.getUTCFullYear() === anio);
      if (delMes.length === 0) return null;
      const presentes = delMes.filter((a) => a.estado === "presente" || a.estado === "tarde").length;
      return Math.round((presentes / delMes.length) * 100);
    };
    const variacion = (actual: number | null, anterior: number | null) =>
      actual === null || anterior === null ? null : actual - anterior;

    return {
      mesAnteriorNombre: NOMBRES_MES[mesAnterior - 1],
      alumnosNuevosMes: alumnos.filter(
        (a) => a.fechaInscripcion.getUTCFullYear() === anioActual && a.fechaInscripcion.getUTCMonth() + 1 === mesActual,
      ).length,
      cuotasAlDiaVariacionPp: variacion(pctCuotasAlDia(mesActual, anioActual), pctCuotasAlDia(mesAnterior, anioAnterior)),
      asistenciaVariacionPp: variacion(pctAsistencia(mesActual, anioActual), pctAsistencia(mesAnterior, anioAnterior)),
    };
  }

  async listarReporteAlumnos(cicloId?: string): Promise<ReporteAlumnoResumen[]> {
    const contexto = await this.resolverContextoCiclo(cicloId);
    const alumnoIdsFiltro = contexto ? Array.from(contexto.alumnoIds) : undefined;

    const [alumnosRaw, calificaciones, notasCierre, cuotas, asistencias, pagos] = await Promise.all([
      this.prisma.alumno.findMany({
        where: alumnoIdsFiltro ? { id: { in: alumnoIdsFiltro } } : undefined,
        include: { curso: true },
      }),
      this.prisma.calificacion.findMany({
        where: {
          ...(alumnoIdsFiltro ? { alumnoId: { in: alumnoIdsFiltro } } : {}),
          ...(cicloId ? { evaluacion: { curso: { cicloId } } } : {}),
        },
        include: { evaluacion: true },
      }),
      this.prisma.notaCierre.findMany({
        where: {
          ...(alumnoIdsFiltro ? { alumnoId: { in: alumnoIdsFiltro } } : {}),
          ...(cicloId ? { curso: { cicloId } } : {}),
        },
      }),
      this.prisma.cuota.findMany({
        where: {
          ...(alumnoIdsFiltro ? { alumnoId: { in: alumnoIdsFiltro } } : {}),
          ...(contexto ? { anio: contexto.anio } : {}),
        },
      }),
      this.prisma.asistencia.findMany({
        where: {
          ...(alumnoIdsFiltro ? { alumnoId: { in: alumnoIdsFiltro } } : {}),
          ...(cicloId ? { curso: { cicloId } } : {}),
        },
        select: { alumnoId: true, estado: true },
      }),
      this.prisma.pago.findMany({
        where: alumnoIdsFiltro ? { cuota: { alumnoId: { in: alumnoIdsFiltro } } } : undefined,
        include: { cuota: true },
        orderBy: { fechaPago: "desc" },
      }),
    ]);

    const alumnos = alumnosRaw.map((a) => ({
      ...a,
      curso: contexto?.cursoPorAlumno.get(a.id) ?? a.curso,
    }));

    const promedioPorAlumnoPeriodo = (alumnoId: string, periodo: "julio" | "noviembre"): number | null => {
      const notas = calificaciones
        .filter((c) => c.alumnoId === alumnoId && c.evaluacion.periodo === periodo && c.evaluacion.escala === "numerica")
        .map((c) => Number.parseFloat(c.nota))
        .filter((n) => !Number.isNaN(n));
      if (notas.length === 0) return null;
      return Math.round((notas.reduce((a, n) => a + n, 0) / notas.length) * 10) / 10;
    };

    const notaCierrePorAlumnoPeriodo = (alumnoId: string, periodo: "julio" | "noviembre") => {
      const nc = notasCierre.find((n) => n.alumnoId === alumnoId && n.periodo === periodo);
      if (!nc) return null;
      const nota = Number.parseFloat(nc.nota);
      return { nota: Number.isNaN(nota) ? null : nota, estado: nc.estado };
    };

    return alumnos.map((alumno) => {
      const asistenciasAlumno = asistencias.filter((a) => a.alumnoId === alumno.id);
      const asistenciaPct =
        asistenciasAlumno.length > 0
          ? Math.round(
              (asistenciasAlumno.filter((a) => a.estado === "presente" || a.estado === "tarde").length /
                asistenciasAlumno.length) *
                100,
            )
          : null;

      const cuotasAlumno = cuotas.filter((c) => c.alumnoId === alumno.id);
      const pagosAlumno = pagos.filter((p) => p.cuota.alumnoId === alumno.id);
      const ultimoPago = pagosAlumno[0]?.cuota ?? null;

      return {
        alumnoId: alumno.id,
        alumnoNombre: `${alumno.nombre} ${alumno.apellido}`,
        cursoNombre: alumno.curso?.nombre ?? null,
        cursoNivel: alumno.curso?.nivel ?? null,
        promedioJulio: promedioPorAlumnoPeriodo(alumno.id, "julio"),
        promedioNoviembre: promedioPorAlumnoPeriodo(alumno.id, "noviembre"),
        notaCierreJulio: notaCierrePorAlumnoPeriodo(alumno.id, "julio"),
        notaCierreNoviembre: notaCierrePorAlumnoPeriodo(alumno.id, "noviembre"),
        asistenciaPct,
        cuotasPagas: cuotasAlumno.filter((c) => c.estado === "pagada").length,
        cuotasVencidas: cuotasAlumno.filter((c) => c.estado === "vencida").length,
        deudaTotal: cuotasAlumno.filter((c) => c.estado !== "pagada").reduce((a, c) => a + c.montoFinal, 0),
        montoPagadoTotal: pagosAlumno.reduce((a, p) => a + p.monto, 0),
        ultimoPago: ultimoPago ? { mes: ultimoPago.mes, anio: ultimoPago.anio } : null,
      };
    });
  }
}
