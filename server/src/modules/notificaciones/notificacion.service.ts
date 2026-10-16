import { randomUUID } from "node:crypto";
import { alConfirmar } from "../../core/alConfirmar";
import { EntityNotFoundError, ValidationError } from "../../core/errors";
import type { CanalEnVivo, UnitOfWork } from "../../core/ports";
import type { CriteriosDeAvisos } from "./notificacion.criterios";
import type {
  AvisoEsperado,
  Destinatario,
  Notificacion,
  RecursoAviso,
  TipoEstado,
  TipoNotificacion,
  TonoNotificacion,
} from "./notificacion.entity";
import { reconciliar } from "./notificacion.reconciliar";
import type { FiltroHistorial, NotificacionRepository } from "./notificacion.repository";
import { TIPOS, TIPOS_ESTADO, tiposDelRol } from "./notificacion.tipos";

const DIA_MS = 24 * 60 * 60 * 1000;
const MAX_CAMPANA = 10;
const POR_PAGINA = 50;
const DIAS_DE_HISTORIAL = 30;

export interface AvisoVista {
  id: string;
  tipo: TipoNotificacion;
  tono: TonoNotificacion;
  texto: string;
  recurso: RecursoAviso;
  leida: boolean;
  resuelta: boolean;
  fecha: Date;
}

export interface Preferencia {
  tipo: TipoNotificacion;
  etiqueta: string;
  activa: boolean;
}

const llaveDe = (d: Destinatario) => `${d.usuarioId}|${d.rol}`;
const aVista = (n: Notificacion): AvisoVista => ({
  id: n.id,
  tipo: n.tipo,
  tono: n.tono,
  texto: n.texto,
  recurso: n.recurso,
  leida: n.leidaEn !== null,
  resuelta: n.resueltaEn !== null,
  fecha: n.actualizadaEn,
});

// Avisos guardados por cuenta y rol. Los de estado se sincronizan por tipo completo con su criterio
// (notificacion.criterios); los de evento se crean una vez. Todo se escribe dentro de la transacción de quien lo pide,
// y la señal en tiempo real sale recién después de confirmarla.
export class NotificacionService {
  constructor(
    private readonly repo: NotificacionRepository,
    private readonly criterios: CriteriosDeAvisos,
    private readonly canal: CanalEnVivo,
    private readonly unitOfWork: UnitOfWork,
  ) {}

  // Cada tipo queda bloqueado hasta el final de la transacción: dos operaciones que sincronizan el mismo tipo a la vez
  // van de a una (si no, las dos crearían la misma fila y una fallaría por la clave única).
  async sincronizar(tipos: TipoEstado[], tx: unknown, ahora: Date = new Date()): Promise<void> {
    const orden = [...new Set(tipos)].sort();
    await this.repo.bloquearTipos(orden, tx);
    const afectados: Destinatario[] = [];
    for (const tipo of orden) {
      const apagados = new Set((await this.repo.findDesactivadas(tipo, tx)).map(llaveDe));
      const esperados = (await this.criterios.esperados(tipo, ahora, tx)).filter((e) => !apagados.has(llaveDe(e)));
      const cambios = reconciliar(await this.repo.findPorTipo(tipo, tx), esperados, ahora, randomUUID);
      await this.repo.crearVarias(cambios.crear, tx);
      for (const { id, datos } of cambios.actualizar) await this.repo.actualizarParcial(id, datos, tx);
      await this.repo.resolverVarios(cambios.resolver, ahora, tx);
      afectados.push(...cambios.afectados);
    }
    this.avisarAlConfirmar(afectados, tx);
  }

  async notasPublicadas(evaluacionId: string, alumnoIds: string[] | null, tx: unknown): Promise<void> {
    await this.registrarEventos(await this.criterios.notasPublicadas(evaluacionId, alumnoIds, tx), tx);
  }

  async cierrePublicado(notaCierreId: string, tx: unknown): Promise<void> {
    await this.registrarEventos(await this.criterios.cierrePublicado(notaCierreId, tx), tx);
  }

  async observacionNueva(observacionId: string, tx: unknown): Promise<void> {
    await this.registrarEventos(await this.criterios.observacionNueva(observacionId, tx), tx);
  }

  // Revisión completa (al arrancar y a las 03:00): una transacción por tipo, para no tener bloqueos largos.
  async sincronizarTodo(ahora: Date = new Date()): Promise<void> {
    for (const tipo of TIPOS_ESTADO) await this.unitOfWork.runInTransaction((tx) => this.sincronizar([tipo], tx, ahora));
  }

  // Cada 15 minutos: la asistencia pendiente depende de la hora (una clase que acaba de empezar).
  async sincronizarAsistencia(ahora: Date = new Date()): Promise<void> {
    await this.unitOfWork.runInTransaction((tx) => this.sincronizar(["asistencia_pendiente"], tx, ahora));
  }

  async limpiar(ahora: Date = new Date()): Promise<number> {
    return this.repo.limpiar(new Date(ahora.getTime() - DIAS_DE_HISTORIAL * DIA_MS));
  }

  async campana(d: Destinatario): Promise<{ noLeidas: number; avisos: AvisoVista[] }> {
    const [avisos, noLeidas] = await Promise.all([this.repo.campana(d, MAX_CAMPANA), this.repo.contarNoLeidas(d)]);
    return { noLeidas, avisos: avisos.map(aVista) };
  }

  async historial(
    d: Destinatario,
    filtro: FiltroHistorial,
    despuesDe?: string,
    ahora: Date = new Date(),
  ): Promise<{ avisos: AvisoVista[]; siguiente: string | null }> {
    const desde = new Date(ahora.getTime() - DIAS_DE_HISTORIAL * DIA_MS);
    const avisos = await this.repo.historial(d, { desde, filtro, despuesDe, limite: POR_PAGINA });
    return { avisos: avisos.map(aVista), siguiente: avisos.length === POR_PAGINA ? avisos[avisos.length - 1].id : null };
  }

  async marcarLeida(d: Destinatario, id: string, ahora: Date = new Date()): Promise<void> {
    if (!(await this.repo.marcarLeida(id, d, ahora))) throw new EntityNotFoundError("Notificacion", id);
    await this.avisar([d]);
  }

  async leerTodas(d: Destinatario, ahora: Date = new Date()): Promise<number> {
    const marcadas = await this.repo.marcarTodasLeidas(d, ahora);
    await this.avisar([d]);
    return marcadas;
  }

  async preferencias(d: Destinatario): Promise<Preferencia[]> {
    const apagados = new Set(await this.repo.findDesactivadasDe(d));
    return tiposDelRol(d.rol).map((tipo) => ({ tipo, etiqueta: TIPOS[tipo].etiqueta, activa: !apagados.has(tipo) }));
  }

  // Apagar borra los avisos de ese tipo; encender sincroniza en el momento, así vuelven los de estado vigentes.
  async cambiarPreferencia(d: Destinatario, tipo: TipoNotificacion, activa: boolean): Promise<void> {
    if (!tiposDelRol(d.rol).includes(tipo)) throw new ValidationError("Ese tipo de aviso no corresponde a tu rol");
    await this.unitOfWork.runInTransaction(async (tx) => {
      if (!activa) {
        await this.repo.desactivar(d, tipo, tx);
        this.avisarAlConfirmar([d], tx);
        return;
      }
      await this.repo.activar(d, tipo, tx);
      if (TIPOS[tipo].clase === "estado") await this.sincronizar([tipo as TipoEstado], tx);
    });
  }

  // Avisos de evento: uno por clave (si ya existe se ignora), salvo para quien apagó ese tipo.
  private async registrarEventos(esperados: AvisoEsperado[], tx: unknown, ahora: Date = new Date()): Promise<void> {
    if (esperados.length === 0) return;
    const apagados = new Set<string>();
    for (const tipo of new Set(esperados.map((e) => e.tipo))) {
      for (const d of await this.repo.findDesactivadas(tipo, tx)) apagados.add(`${llaveDe(d)}|${tipo}`);
    }
    const nuevos: Notificacion[] = esperados
      .filter((e) => !apagados.has(`${llaveDe(e)}|${e.tipo}`))
      .map((e) => ({ ...e, id: randomUUID(), clase: "evento", creadaEn: ahora, actualizadaEn: ahora, leidaEn: null, resueltaEn: null }));
    this.avisarAlConfirmar(await this.repo.crearEventos(nuevos, tx), tx);
  }

  private avisarAlConfirmar(destinatarios: Destinatario[], tx: unknown): void {
    if (destinatarios.length > 0) alConfirmar(tx, () => this.avisar(destinatarios));
  }

  // Señal "tu campana cambió" a las conexiones abiertas de esa cuenta con ese rol: solo el número de no leídos.
  private async avisar(destinatarios: Destinatario[]): Promise<void> {
    const unicos = new Map(destinatarios.map((d) => [llaveDe(d), d]));
    for (const d of unicos.values()) {
      if (!this.canal.conectado(d.usuarioId, d.rol)) continue;
      this.canal.enviarA(d.usuarioId, d.rol, { tipo: "notificaciones", datos: { noLeidas: await this.repo.contarNoLeidas(d) } });
    }
  }
}
