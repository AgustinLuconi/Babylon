import type { Prisma, PrismaClient } from "@prisma/client";
import { fechaHoraEnArgentina, inicioDeHoyUtc } from "../../core/fechas";
import { esMesLectivo } from "../cuotas/cuota.calendario";
import type { DocumentoRepository } from "../documentos/documento.repository";
import type { CriteriosDeAvisos } from "./notificacion.criterios";
import type { AvisoEsperado, Destinatario, TipoEstado } from "./notificacion.entity";

const DIA_MS = 24 * 60 * 60 * 1000;
const DIAS_CUOTA_POR_VENCER = 5;
const DIAS_EVALUACION_PROXIMA = 7;
const DIAS_ASISTENCIA = 7;
const DIAS_SEMANA = ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"] as const;
const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const PERIODOS: Record<string, string> = { julio: "1° Cierre", noviembre: "2° Cierre" };

const dos = (n: number) => String(n).padStart(2, "0");
const formatMonto = (monto: number) => `$${monto.toLocaleString("es-AR")}`;
// Las fechas calendario (vencimientos, evaluaciones, asistencia) se guardan a medianoche UTC.
const diaMes = (fecha: Date) => `${dos(fecha.getUTCDate())}/${dos(fecha.getUTCMonth() + 1)}`;
const cantidad = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;
// Tipa cada aviso armado dentro de un map (si no, "padre" se ensancharía a string).
const aviso = (a: AvisoEsperado): AvisoEsperado => a;

// Criterios de los avisos sobre Prisma. Como reportes/, es una lectura que cruza varios módulos, así que consulta
// Prisma directo; la documentación pendiente sale del criterio único de documentos/. Destinatarios: solo cuentas
// activas, por rol. Todo "hoy" es en hora de Argentina.
export class PrismaCriteriosDeAvisos implements CriteriosDeAvisos {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly documentoRepo: DocumentoRepository,
  ) {}

  private db(tx?: unknown) {
    return (tx as Prisma.TransactionClient | undefined) ?? this.prisma;
  }

  esperados(tipo: TipoEstado, ahora: Date, tx?: unknown): Promise<AvisoEsperado[]> {
    switch (tipo) {
      case "cuotas_vencidas":
        return this.cuotasVencidas(tx);
      case "documentacion_pendiente":
        return this.documentacionPendiente(tx);
      case "evaluacion_proxima":
        return this.evaluacionesProximas(ahora, tx);
      case "asistencia_pendiente":
        return this.asistenciaPendiente(ahora, tx);
      case "notas_sin_publicar":
        return this.notasSinPublicar(tx);
      case "cierre_sin_publicar":
        return this.cierresSinPublicar(tx);
      case "cuota":
        return this.cuotasDePadres(ahora, tx);
      case "documentacion_hijo":
        return this.documentacionDeHijos(tx);
    }
  }

  // ── Destinatarios ────────────────────────────────────────────────────────
  private async staff(tx?: unknown): Promise<Destinatario[]> {
    const cuentas = await this.db(tx).usuario.findMany({
      where: { estado: "activo", roles: { hasSome: ["admin", "secretario"] } },
      select: { id: true, roles: true },
    });
    return cuentas.flatMap((c) =>
      c.roles.filter((r) => r === "admin" || r === "secretario").map((rol) => ({ usuarioId: c.id, rol })),
    );
  }

  // profesorId → su cuenta (activa y con el rol profesor).
  private async cuentasDeProfesores(tx?: unknown): Promise<Map<string, string>> {
    const profesores = await this.db(tx).profesor.findMany({
      where: { usuario: { estado: "activo", roles: { has: "profesor" } } },
      select: { id: true, usuarioId: true },
    });
    return new Map(profesores.map((p) => [p.id, p.usuarioId as string]));
  }

  // padreId → su cuenta (activa y con el rol padre).
  private async cuentasDePadres(tx?: unknown): Promise<Map<string, string>> {
    const padres = await this.db(tx).padre.findMany({
      where: { usuario: { estado: "activo", roles: { has: "padre" } } },
      select: { id: true, usuarioId: true },
    });
    return new Map(padres.map((p) => [p.id, p.usuarioId as string]));
  }

  // ── Administración y secretaría ──────────────────────────────────────────
  // Mismo criterio que la pestaña Vencidas de Cuotas: todas las cuotas vencidas.
  private async cuotasVencidas(tx?: unknown): Promise<AvisoEsperado[]> {
    const n = await this.db(tx).cuota.count({ where: { estado: "vencida" } });
    if (n === 0) return [];
    const texto = `Hay ${cantidad(n, "cuota vencida", "cuotas vencidas")}`;
    return (await this.staff(tx)).map((d) =>
      aviso({ ...d, tipo: "cuotas_vencidas", clave: "cuotas-vencidas", tono: "danger", texto, recurso: { tipo: "cuotas-vencidas" }, nivel: n }),
    );
  }

  private async documentacionPendiente(tx?: unknown): Promise<AvisoEsperado[]> {
    const n = (await this.documentoRepo.findFaltantes(tx)).length;
    if (n === 0) return [];
    const texto = `Hay ${cantidad(n, "alumno", "alumnos")} con documentación pendiente`;
    return (await this.staff(tx)).map((d) =>
      aviso({ ...d, tipo: "documentacion_pendiente", clave: "documentacion-pendiente", tono: "warning", texto, recurso: { tipo: "documentacion-pendiente" }, nivel: n }),
    );
  }

  private async evaluacionesProximas(ahora: Date, tx?: unknown): Promise<AvisoEsperado[]> {
    const hoy = inicioDeHoyUtc(ahora);
    const evaluaciones = await this.db(tx).evaluacion.findMany({
      where: {
        fecha: { gte: hoy, lt: new Date(hoy.getTime() + (DIAS_EVALUACION_PROXIMA + 1) * DIA_MS) },
        curso: { estado: "activo", ciclo: { activo: true } },
      },
      include: { curso: { select: { nombre: true } } },
    });
    const staff = await this.staff(tx);
    return evaluaciones.flatMap((e) =>
      staff.map((d) =>
        aviso({
          ...d,
          tipo: "evaluacion_proxima",
          clave: `evaluacion-proxima:${e.id}`,
          tono: "info",
          texto: `Evaluación próxima: ${e.nombre} — ${e.curso.nombre} (${diaMes(e.fecha)})`,
          recurso: { tipo: "evaluacion", cursoId: e.cursoId, evaluacionId: e.id },
          nivel: 0,
        }),
      ),
    );
  }

  // ── Profesor ─────────────────────────────────────────────────────────────
  // Clases de los últimos 7 días (hoy incluido, solo si ya empezó) sin ninguna asistencia ese día, en meses lectivos.
  private async asistenciaPendiente(ahora: Date, tx?: unknown): Promise<AvisoEsperado[]> {
    const cuentas = await this.cuentasDeProfesores(tx);
    if (cuentas.size === 0) return [];
    const cursos = await this.db(tx).curso.findMany({
      where: { profesorId: { in: [...cuentas.keys()] }, estado: "activo", ciclo: { activo: true } },
      include: { horarios: true },
    });
    const hoy = inicioDeHoyUtc(ahora);
    const desde = new Date(hoy.getTime() - (DIAS_ASISTENCIA - 1) * DIA_MS);
    const tomadas = await this.db(tx).asistencia.groupBy({
      by: ["cursoId", "fecha"],
      where: { cursoId: { in: cursos.map((c) => c.id) }, fecha: { gte: desde, lt: new Date(hoy.getTime() + DIA_MS) } },
    });
    const conAsistencia = new Set(tomadas.map((t) => `${t.cursoId}|${t.fecha.toISOString().slice(0, 10)}`));
    const { hora, minuto } = fechaHoraEnArgentina(ahora);
    const ahoraHHMM = `${dos(hora)}:${dos(minuto)}`;

    const lista: AvisoEsperado[] = [];
    for (let atras = 0; atras < DIAS_ASISTENCIA; atras++) {
      const dia = new Date(hoy.getTime() - atras * DIA_MS);
      if (!esMesLectivo(dia.getUTCMonth() + 1)) continue;
      const fecha = dia.toISOString().slice(0, 10);
      const nombreDia = DIAS_SEMANA[dia.getUTCDay()];
      for (const curso of cursos) {
        const clases = curso.horarios
          .filter((h) => h.diaSemana === nombreDia && (atras > 0 || h.horaInicio <= ahoraHHMM))
          .map((h) => h.horaInicio)
          .sort();
        if (clases.length === 0 || conAsistencia.has(`${curso.id}|${fecha}`)) continue;
        lista.push(
          aviso({
            usuarioId: cuentas.get(curso.profesorId) as string,
            rol: "profesor",
            tipo: "asistencia_pendiente",
            clave: `asistencia:${curso.id}:${fecha}`,
            tono: "warning",
            texto: atras === 0 ? `Falta tomar asistencia de ${curso.nombre} (hoy ${clases[0]})` : `Falta tomar asistencia de ${curso.nombre} del ${diaMes(dia)}`,
            recurso: { tipo: "asistencia", cursoId: curso.id, fecha },
            nivel: 0,
          }),
        );
      }
    }
    return lista;
  }

  private async notasSinPublicar(tx?: unknown): Promise<AvisoEsperado[]> {
    const cuentas = await this.cuentasDeProfesores(tx);
    const evaluaciones = await this.db(tx).evaluacion.findMany({
      where: {
        estado: "borrador",
        calificaciones: { some: {} },
        curso: { profesorId: { in: [...cuentas.keys()] }, estado: "activo", ciclo: { activo: true } },
      },
      include: { curso: { select: { nombre: true, profesorId: true } } },
    });
    return evaluaciones.map((e) =>
      aviso({
        usuarioId: cuentas.get(e.curso.profesorId) as string,
        rol: "profesor",
        tipo: "notas_sin_publicar",
        clave: `notas-sin-publicar:${e.id}`,
        tono: "info",
        texto: `"${e.nombre}" (${e.curso.nombre}) tiene notas cargadas y sigue sin publicar`,
        recurso: { tipo: "evaluacion", cursoId: e.cursoId, evaluacionId: e.id },
        nivel: 0,
      }),
    );
  }

  private async cierresSinPublicar(tx?: unknown): Promise<AvisoEsperado[]> {
    const cuentas = await this.cuentasDeProfesores(tx);
    const borradores = await this.db(tx).notaCierre.findMany({
      where: { estado: "borrador", curso: { profesorId: { in: [...cuentas.keys()] }, estado: "activo", ciclo: { activo: true } } },
      distinct: ["cursoId", "periodo"],
      select: { cursoId: true, periodo: true, curso: { select: { nombre: true, profesorId: true } } },
    });
    return borradores.map((b) =>
      aviso({
        usuarioId: cuentas.get(b.curso.profesorId) as string,
        rol: "profesor",
        tipo: "cierre_sin_publicar",
        clave: `cierre-sin-publicar:${b.cursoId}:${b.periodo}`,
        tono: "info",
        texto: `Notas de cierre de ${b.curso.nombre} (${PERIODOS[b.periodo] ?? b.periodo}) en borrador`,
        recurso: { tipo: "cierre", cursoId: b.cursoId, periodo: b.periodo },
        nivel: 0,
      }),
    );
  }

  // ── Padre ────────────────────────────────────────────────────────────────
  // Una sola fila por cuota: "por vencer" (nivel 1) y "vencida" (nivel 2) son el mismo aviso que se agrava.
  private async cuotasDePadres(ahora: Date, tx?: unknown): Promise<AvisoEsperado[]> {
    const cuentas = await this.cuentasDePadres(tx);
    const hoy = inicioDeHoyUtc(ahora);
    const cuotas = await this.db(tx).cuota.findMany({
      where: { estado: { in: ["vencida", "pendiente"] }, alumno: { estado: "activo", padreId: { in: [...cuentas.keys()] } } },
      include: { alumno: { select: { nombre: true, padreId: true } } },
    });
    const lista: AvisoEsperado[] = [];
    for (const c of cuotas) {
      const mes = `${MESES[c.mes - 1]} ${c.anio}`;
      const base = {
        usuarioId: cuentas.get(c.alumno.padreId as string) as string,
        rol: "padre" as const,
        tipo: "cuota" as const,
        clave: `cuota:${c.id}`,
        recurso: { tipo: "cuota" as const, alumnoId: c.alumnoId, cuotaId: c.id },
      };
      if (c.estado === "vencida") {
        lista.push({ ...base, tono: "danger", texto: `Cuota de ${mes} de ${c.alumno.nombre} vencida — ${formatMonto(c.montoFinal)}`, nivel: 2 });
        continue;
      }
      const dias = Math.round((c.vencimiento.getTime() - hoy.getTime()) / DIA_MS);
      if (dias >= 0 && dias <= DIAS_CUOTA_POR_VENCER) {
        lista.push({ ...base, tono: "warning", texto: `La cuota de ${mes} de ${c.alumno.nombre} vence el ${diaMes(c.vencimiento)}`, nivel: 1 });
      }
    }
    return lista;
  }

  private async documentacionDeHijos(tx?: unknown): Promise<AvisoEsperado[]> {
    const cuentas = await this.cuentasDePadres(tx);
    return (await this.documentoRepo.findFaltantes(tx))
      .filter((f) => f.padreId !== null && cuentas.has(f.padreId))
      .map((f) =>
        aviso({
          usuarioId: cuentas.get(f.padreId as string) as string,
          rol: "padre",
          tipo: "documentacion_hijo",
          clave: `documentacion:${f.alumnoId}`,
          tono: "warning",
          texto: `${f.nombre} tiene documentación pendiente`,
          recurso: { tipo: "documentacion", alumnoId: f.alumnoId },
          nivel: 0,
        }),
      );
  }

  // ── Eventos (solo publicado, solo hijos activos, solo cuentas activas) ──────
  async notasPublicadas(evaluacionId: string, alumnoIds: string[] | null, tx?: unknown): Promise<AvisoEsperado[]> {
    const e = await this.db(tx).evaluacion.findUnique({
      where: { id: evaluacionId },
      include: {
        calificaciones: {
          where: alumnoIds ? { alumnoId: { in: alumnoIds } } : undefined,
          include: { alumno: { select: { nombre: true, estado: true, padreId: true } } },
        },
      },
    });
    if (!e || e.estado !== "publicada") return [];
    const cuentas = await this.cuentasDePadres(tx);
    return e.calificaciones
      .filter((c) => c.alumno.estado === "activo" && c.alumno.padreId !== null && cuentas.has(c.alumno.padreId))
      .map((c) =>
        aviso({
          usuarioId: cuentas.get(c.alumno.padreId as string) as string,
          rol: "padre",
          tipo: "nota_publicada",
          clave: `nota:${e.id}:${c.alumnoId}`,
          tono: "info",
          texto: `Nueva nota de ${c.alumno.nombre}: ${e.nombre}`,
          recurso: { tipo: "calificaciones", alumnoId: c.alumnoId },
          nivel: 0,
        }),
      );
  }

  async cierrePublicado(notaCierreId: string, tx?: unknown): Promise<AvisoEsperado[]> {
    const n = await this.db(tx).notaCierre.findUnique({
      where: { id: notaCierreId },
      include: { alumno: { select: { nombre: true, estado: true, padreId: true } } },
    });
    if (!n || n.estado !== "publicada" || !n.publicadaEn || n.alumno.estado !== "activo" || !n.alumno.padreId) return [];
    const usuarioId = (await this.cuentasDePadres(tx)).get(n.alumno.padreId);
    if (!usuarioId) return [];
    return [
      aviso({
        usuarioId,
        rol: "padre",
        tipo: "cierre_publicado",
        // Con el momento de publicación: si vuelve a borrador y se republica, es un aviso nuevo.
        clave: `cierre:${n.id}:${n.publicadaEn.getTime()}`,
        tono: "info",
        texto: `Nota de cierre (${PERIODOS[n.periodo] ?? n.periodo}) de ${n.alumno.nombre} publicada`,
        recurso: { tipo: "calificaciones", alumnoId: n.alumnoId },
        nivel: 0,
      }),
    ];
  }

  async observacionNueva(observacionId: string, tx?: unknown): Promise<AvisoEsperado[]> {
    const o = await this.db(tx).observacion.findUnique({
      where: { id: observacionId },
      include: { alumno: { select: { nombre: true, estado: true, padreId: true } } },
    });
    if (!o || o.alumno.estado !== "activo" || !o.alumno.padreId) return [];
    const usuarioId = (await this.cuentasDePadres(tx)).get(o.alumno.padreId);
    if (!usuarioId) return [];
    return [
      aviso({
        usuarioId,
        rol: "padre",
        tipo: "observacion_nueva",
        clave: `observacion:${o.id}`,
        tono: "info",
        texto: `Nueva observación sobre ${o.alumno.nombre}`,
        recurso: { tipo: "hijo", alumnoId: o.alumnoId },
        nivel: 0,
      }),
    ];
  }
}
