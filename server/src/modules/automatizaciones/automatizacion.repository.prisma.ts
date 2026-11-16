import type { Prisma, PrismaClient } from "@prisma/client";
import { REGLAS, type AlertaAutomatica, type ConfigDeRegla, type MotivoCierre, type ReglaId } from "./automatizacion.entity";
import type { AlertaConNombres, AutomatizacionRepository } from "./automatizacion.repository";

type FilaAlerta = Awaited<ReturnType<PrismaClient["alertaAutomatica"]["findUniqueOrThrow"]>>;
const aAlerta = (f: FilaAlerta): AlertaAutomatica => ({ ...f, regla: f.regla as ReglaId, motivoCierre: f.motivoCierre as MotivoCierre | null });
const aConfig = (f: { regla: string; activa: boolean; umbral: number; ultimaRevisionEn: Date | null }): ConfigDeRegla => ({ ...f, regla: f.regla as ReglaId });

export class PrismaAutomatizacionRepository implements AutomatizacionRepository {
  constructor(private readonly prisma: PrismaClient) {}

  private client(tx?: unknown) {
    return (tx as Prisma.TransactionClient | undefined) ?? this.prisma;
  }

  async obtenerConfig(regla: ReglaId, tx?: unknown): Promise<ConfigDeRegla> {
    const fila = await this.client(tx).automatizacion.upsert({
      where: { regla },
      update: {},
      create: { regla, activa: true, umbral: REGLAS[regla].umbralPorDefecto },
    });
    return aConfig(fila);
  }

  async actualizarConfig(regla: ReglaId, cambios: Partial<Pick<ConfigDeRegla, "activa" | "umbral" | "ultimaRevisionEn">>, tx?: unknown): Promise<ConfigDeRegla> {
    await this.obtenerConfig(regla, tx);
    return aConfig(await this.client(tx).automatizacion.update({ where: { regla }, data: cambios }));
  }

  async bloquearRegla(regla: ReglaId, tx?: unknown): Promise<void> {
    await this.client(tx).$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`automatizacion:${regla}`}, 0))`;
  }

  async findAbiertas(regla: ReglaId, tx?: unknown): Promise<AlertaAutomatica[]> {
    return (await this.client(tx).alertaAutomatica.findMany({ where: { regla, resueltaEn: null } })).map(aAlerta);
  }

  async contarAbiertas(regla: ReglaId, tx?: unknown): Promise<number> {
    return this.client(tx).alertaAutomatica.count({ where: { regla, resueltaEn: null } });
  }

  async crearAlertas(alertas: AlertaAutomatica[], tx?: unknown): Promise<void> {
    if (alertas.length === 0) return;
    await this.client(tx).alertaAutomatica.createMany({ data: alertas });
  }

  async actualizarNivel(id: string, nivel: number, tx?: unknown): Promise<void> {
    await this.client(tx).alertaAutomatica.update({ where: { id }, data: { nivel } });
  }

  async cerrarAlertas(cierres: { id: string; motivo: MotivoCierre }[], ahora: Date, tx?: unknown): Promise<void> {
    const porMotivo = new Map<MotivoCierre, string[]>();
    for (const { id, motivo } of cierres) porMotivo.set(motivo, [...(porMotivo.get(motivo) ?? []), id]);
    for (const [motivoCierre, ids] of porMotivo) {
      await this.client(tx).alertaAutomatica.updateMany({ where: { id: { in: ids } }, data: { resueltaEn: ahora, motivoCierre } });
    }
  }

  async historial(regla: ReglaId, pagina: number, porPagina: number, tx?: unknown): Promise<{ filas: AlertaConNombres[]; total: number }> {
    const db = this.client(tx);
    const [total, filas] = await Promise.all([
      db.alertaAutomatica.count({ where: { regla } }),
      db.alertaAutomatica.findMany({
        where: { regla },
        orderBy: [{ abiertaEn: "desc" }, { id: "desc" }],
        skip: (Math.max(1, pagina) - 1) * porPagina,
        take: porPagina,
        include: { alumno: { select: { nombre: true, apellido: true } }, curso: { select: { nombre: true } }, evaluacion: { select: { nombre: true } } },
      }),
    ]);
    return {
      total,
      filas: filas.map((f) => ({ ...aAlerta(f), alumnoNombre: f.alumno ? `${f.alumno.nombre} ${f.alumno.apellido}` : null, evaluacionNombre: f.evaluacion?.nombre ?? null, cursoNombre: f.curso?.nombre ?? null })),
    };
  }
}
