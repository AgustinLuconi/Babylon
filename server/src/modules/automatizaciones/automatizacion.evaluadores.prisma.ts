import type { Prisma, PrismaClient } from "@prisma/client";
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
}
