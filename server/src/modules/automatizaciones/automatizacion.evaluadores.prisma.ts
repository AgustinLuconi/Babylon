import type { Prisma, PrismaClient } from "@prisma/client";
import { inicioDeHoyUtc } from "../../core/fechas";
import { evaluacionSinNotas } from "./automatizacion.sinNotas";
import { rachaDeInasistencias } from "./automatizacion.racha";
import { claveDeAlerta, type AlertaEsperada } from "./automatizacion.reconciliar";
import type { EvaluacionDeRegla, EvaluadoresDeReglas } from "./automatizacion.entity";

// Las consultas de cada regla (lectura cruzada sobre Prisma, como `reportes/` y los criterios de avisos). Ambas miran solo a
// los alumnos activos con inscripción en el ciclo activo.
export class PrismaEvaluadoresDeReglas implements EvaluadoresDeReglas {
  constructor(private readonly prisma: PrismaClient) {}

  private db(tx?: unknown) {
    return (tx as Prisma.TransactionClient | undefined) ?? this.prisma;
  }

  readonly deuda_cuotas = {
    evaluar: async (umbral: number, tx?: unknown): Promise<EvaluacionDeRegla> => {
      const inscripciones = await this.db(tx).inscripcion.findMany({ where: { ciclo: { activo: true }, alumno: { estado: "activo" } }, select: { alumnoId: true } });
      const alumnoIds = [...new Set(inscripciones.map((i) => i.alumnoId))];
      const grupos = await this.db(tx).cuota.groupBy({ by: ["alumnoId"], where: { estado: "vencida", alumnoId: { in: alumnoIds } }, _count: { _all: true } });
      const esperadas: AlertaEsperada[] = grupos.filter((g) => g._count._all >= umbral).map((g) => ({ alumnoId: g.alumnoId, cursoId: null, nivel: g._count._all }));
      return { esperadas, poblacion: new Set(alumnoIds.map((alumnoId) => claveDeAlerta({ alumnoId, cursoId: null }))) };
    },
  };

  readonly inasistencias_seguidas = {
    evaluar: async (umbral: number, tx?: unknown): Promise<EvaluacionDeRegla> => {
      const inscripciones = await this.db(tx).inscripcion.findMany({ where: { ciclo: { activo: true }, alumno: { estado: "activo" } }, select: { alumnoId: true, cursoId: true } });
      const pares = new Map(inscripciones.map((i) => [claveDeAlerta(i), i]));
      const registros = await this.db(tx).asistencia.findMany({
        where: { alumnoId: { in: [...new Set(inscripciones.map((i) => i.alumnoId))] }, cursoId: { in: [...new Set(inscripciones.map((i) => i.cursoId))] } },
        select: { alumnoId: true, cursoId: true, fecha: true, estado: true, justificada: true },
      });
      // Los registros de cada par (alumno, curso de su inscripción); los de otros cursos del mismo alumno no cuentan.
      const porPar = new Map<string, typeof registros>();
      for (const r of registros) {
        const clave = claveDeAlerta(r);
        if (pares.has(clave)) porPar.set(clave, [...(porPar.get(clave) ?? []), r]);
      }
      const esperadas: AlertaEsperada[] = [];
      for (const filas of porPar.values()) {
        const racha = rachaDeInasistencias(filas);
        if (racha >= umbral) esperadas.push({ alumnoId: filas[0].alumnoId, cursoId: filas[0].cursoId, nivel: racha });
      }
      return { esperadas, poblacion: new Set(pares.keys()) };
    },
  };

  // Evaluaciones del ciclo activo, de cursos activos, con `umbral` días o más desde su fecha y ninguna nota cargada. La población
  // son todas las evaluaciones que se miran: una que deja de estar esperada y sigue en ella se cierra como "resuelta" (se cargó una
  // nota); una que sale (curso inactivo, otro ciclo) como "ya-no-corresponde".
  readonly evaluacion_sin_notas = {
    evaluar: async (umbral: number, tx?: unknown, ahora: Date = new Date()): Promise<EvaluacionDeRegla> => {
      const hoy = inicioDeHoyUtc(ahora);
      const evaluaciones = await this.db(tx).evaluacion.findMany({
        // Un curso sin alumnos activos no entra: no hay a quién ponerle nota.
        where: { curso: { estado: "activo", ciclo: { activo: true }, inscripciones: { some: { alumno: { estado: "activo" } } } } },
        select: { id: true, cursoId: true, fecha: true, _count: { select: { calificaciones: true } } },
      });
      const clave = (e: { cursoId: string; id: string }) => claveDeAlerta({ alumnoId: null, cursoId: e.cursoId, evaluacionId: e.id });
      const esperadas: AlertaEsperada[] = evaluaciones
        .filter((e) => evaluacionSinNotas({ fecha: e.fecha, notas: e._count.calificaciones }, hoy, umbral))
        .map((e) => ({ alumnoId: null, cursoId: e.cursoId, evaluacionId: e.id, nivel: 1 }));
      return { esperadas, poblacion: new Set(evaluaciones.map(clave)) };
    },
  };

  // Un alumno con una alerta abierta de deuda **y** una de inasistencias seguidas. Lee las alertas ya reconciliadas (la
  // revisión corre después de esas dos reglas, en la misma transacción), no vuelve a mirar cuotas ni asistencia.
  readonly alumno_en_riesgo = {
    evaluar: async (_umbral: number, tx?: unknown): Promise<EvaluacionDeRegla> => {
      const abiertas = await this.db(tx).alertaAutomatica.findMany({
        where: { regla: { in: ["deuda_cuotas", "inasistencias_seguidas"] }, resueltaEn: null, alumnoId: { not: null } },
        select: { regla: true, alumnoId: true },
      });
      const conDeuda = new Set(abiertas.filter((a) => a.regla === "deuda_cuotas").map((a) => a.alumnoId));
      const conFaltas = new Set(abiertas.filter((a) => a.regla === "inasistencias_seguidas").map((a) => a.alumnoId));
      const esperadas: AlertaEsperada[] = [...conDeuda].filter((id): id is string => id !== null && conFaltas.has(id)).map((alumnoId) => ({ alumnoId, cursoId: null, nivel: 1 }));
      const inscripciones = await this.db(tx).inscripcion.findMany({ where: { ciclo: { activo: true }, alumno: { estado: "activo" } }, select: { alumnoId: true } });
      return { esperadas, poblacion: new Set(inscripciones.map((i) => claveDeAlerta({ alumnoId: i.alumnoId, cursoId: null }))) };
    },
  };
}
