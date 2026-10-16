import type { Prisma, PrismaClient } from "@prisma/client";
import type { Destinatario, Notificacion, RecursoAviso, TipoNotificacion } from "./notificacion.entity";
import type { NotificacionRepository, OpcionesHistorial } from "./notificacion.repository";

type Fila = Awaited<ReturnType<PrismaClient["notificacion"]["findUniqueOrThrow"]>>;

const aEntidad = (f: Fila): Notificacion => ({ ...f, recurso: f.recurso as unknown as RecursoAviso });
const aFila = (n: Notificacion): Prisma.NotificacionCreateManyInput => ({ ...n, recurso: n.recurso as unknown as Prisma.InputJsonValue });
const aCambios = ({ recurso, ...resto }: Partial<Notificacion>): Prisma.NotificacionUncheckedUpdateInput => ({
  ...resto,
  ...(recurso ? { recurso: recurso as unknown as Prisma.InputJsonValue } : {}),
});
const llave = (x: { usuarioId: string; rol: string; clave: string }) => `${x.usuarioId}|${x.rol}|${x.clave}`;

export class PrismaNotificacionRepository implements NotificacionRepository {
  constructor(private readonly prisma: PrismaClient) {}

  private client(tx?: unknown) {
    return (tx as Prisma.TransactionClient | undefined) ?? this.prisma;
  }

  async findById(id: string, tx?: unknown): Promise<Notificacion | null> {
    const f = await this.client(tx).notificacion.findUnique({ where: { id } });
    return f ? aEntidad(f) : null;
  }

  async findAll(tx?: unknown): Promise<Notificacion[]> {
    return (await this.client(tx).notificacion.findMany()).map(aEntidad);
  }

  async create(n: Notificacion, tx?: unknown): Promise<Notificacion> {
    return aEntidad(await this.client(tx).notificacion.create({ data: aFila(n) }));
  }

  async update(id: string, n: Notificacion, tx?: unknown): Promise<Notificacion> {
    return aEntidad(await this.client(tx).notificacion.update({ where: { id }, data: aCambios(n) }));
  }

  async delete(id: string, tx?: unknown): Promise<void> {
    await this.client(tx).notificacion.delete({ where: { id } });
  }

  async bloquearTipos(tipos: TipoNotificacion[], tx: unknown): Promise<void> {
    for (const tipo of [...tipos].sort()) {
      await this.client(tx).$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`avisos:${tipo}`}, 0))`;
    }
  }

  async findPorTipo(tipo: TipoNotificacion, tx?: unknown): Promise<Notificacion[]> {
    return (await this.client(tx).notificacion.findMany({ where: { tipo } })).map(aEntidad);
  }

  async crearVarias(avisos: Notificacion[], tx?: unknown): Promise<void> {
    if (avisos.length > 0) await this.client(tx).notificacion.createMany({ data: avisos.map(aFila) });
  }

  async actualizarParcial(id: string, datos: Partial<Notificacion>, tx?: unknown): Promise<void> {
    await this.client(tx).notificacion.update({ where: { id }, data: aCambios(datos) });
  }

  async resolverVarios(ids: string[], ahora: Date, tx?: unknown): Promise<void> {
    if (ids.length > 0) {
      await this.client(tx).notificacion.updateMany({ where: { id: { in: ids } }, data: { resueltaEn: ahora, actualizadaEn: ahora } });
    }
  }

  async crearEventos(avisos: Notificacion[], tx?: unknown): Promise<Destinatario[]> {
    if (avisos.length === 0) return [];
    const db = this.client(tx);
    const existentes = await db.notificacion.findMany({
      where: { OR: avisos.map(({ usuarioId, rol, clave }) => ({ usuarioId, rol, clave })) },
      select: { usuarioId: true, rol: true, clave: true },
    });
    const yaEstan = new Set(existentes.map(llave));
    const nuevos = avisos.filter((a) => !yaEstan.has(llave(a)));
    // skipDuplicates: si otra transacción creó el mismo evento a la vez, se ignora en lugar de fallar.
    await db.notificacion.createMany({ data: nuevos.map(aFila), skipDuplicates: true });
    return nuevos.map(({ usuarioId, rol }) => ({ usuarioId, rol }));
  }

  async findDesactivadas(tipo: TipoNotificacion, tx?: unknown): Promise<Destinatario[]> {
    return this.client(tx).notificacionDesactivada.findMany({ where: { tipo }, select: { usuarioId: true, rol: true } });
  }

  async findDesactivadasDe({ usuarioId, rol }: Destinatario, tx?: unknown): Promise<TipoNotificacion[]> {
    return (await this.client(tx).notificacionDesactivada.findMany({ where: { usuarioId, rol }, select: { tipo: true } })).map((f) => f.tipo);
  }

  async desactivar({ usuarioId, rol }: Destinatario, tipo: TipoNotificacion, tx?: unknown): Promise<void> {
    const db = this.client(tx);
    await db.notificacionDesactivada.createMany({ data: [{ usuarioId, rol, tipo }], skipDuplicates: true });
    await db.notificacion.deleteMany({ where: { usuarioId, rol, tipo } });
  }

  async activar({ usuarioId, rol }: Destinatario, tipo: TipoNotificacion, tx?: unknown): Promise<void> {
    await this.client(tx).notificacionDesactivada.deleteMany({ where: { usuarioId, rol, tipo } });
  }

  async campana({ usuarioId, rol }: Destinatario, limite: number): Promise<Notificacion[]> {
    const filas = await this.prisma.notificacion.findMany({
      where: { usuarioId, rol, resueltaEn: null, OR: [{ leidaEn: null }, { clase: "estado" }] },
      orderBy: [{ leidaEn: { sort: "asc", nulls: "first" } }, { actualizadaEn: "desc" }, { id: "desc" }],
      take: limite,
    });
    return filas.map(aEntidad);
  }

  async contarNoLeidas({ usuarioId, rol }: Destinatario): Promise<number> {
    return this.prisma.notificacion.count({ where: { usuarioId, rol, leidaEn: null, resueltaEn: null } });
  }

  async historial({ usuarioId, rol }: Destinatario, { desde, filtro, despuesDe, limite }: OpcionesHistorial): Promise<Notificacion[]> {
    const porFiltro: Prisma.NotificacionWhereInput =
      filtro === "no-leidas" ? { leidaEn: null, resueltaEn: null } : filtro === "pendientes" ? { clase: "estado", resueltaEn: null } : {};
    const filas = await this.prisma.notificacion.findMany({
      where: { usuarioId, rol, actualizadaEn: { gte: desde }, ...porFiltro },
      orderBy: [{ actualizadaEn: "desc" }, { id: "desc" }],
      take: limite,
      ...(despuesDe ? { cursor: { id: despuesDe }, skip: 1 } : {}),
    });
    return filas.map(aEntidad);
  }

  async marcarLeida(id: string, { usuarioId, rol }: Destinatario, ahora: Date): Promise<boolean> {
    const fila = await this.prisma.notificacion.findFirst({ where: { id, usuarioId, rol }, select: { leidaEn: true } });
    if (!fila) return false;
    if (!fila.leidaEn) await this.prisma.notificacion.updateMany({ where: { id, leidaEn: null }, data: { leidaEn: ahora } });
    return true;
  }

  async marcarTodasLeidas({ usuarioId, rol }: Destinatario, ahora: Date): Promise<number> {
    const { count } = await this.prisma.notificacion.updateMany({ where: { usuarioId, rol, leidaEn: null }, data: { leidaEn: ahora } });
    return count;
  }

  async limpiar(antesDe: Date): Promise<number> {
    const { count } = await this.prisma.notificacion.deleteMany({
      where: { actualizadaEn: { lt: antesDe }, OR: [{ clase: "evento" }, { resueltaEn: { not: null } }] },
    });
    return count;
  }
}
