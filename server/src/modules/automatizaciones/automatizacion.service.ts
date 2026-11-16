import { randomUUID } from "node:crypto";
import { EntityNotFoundError, ValidationError } from "../../core/errors";
import { sinAnuncios } from "../../core/eventos";
import type { Publicador, UnitOfWork } from "../../core/ports";
import type { EventosCambios } from "../cambios/cambio.eventos";
import { REGLAS, REGLA_IDS, type EvaluadoresDeReglas, type MotivoCierre, type ReglaId } from "./automatizacion.entity";
import type { EventosAutomatizaciones } from "./automatizacion.eventos";
import { reconciliarAlertas } from "./automatizacion.reconciliar";
import type { AutomatizacionRepository } from "./automatizacion.repository";
import type { ActualizarAutomatizacionInput } from "./automatizacion.schema";

// Una regla con su catálogo, su configuración y cuántos alumnos están en alerta ahora (lo que muestra el panel).
export interface ReglaConEstado {
  id: ReglaId;
  nombre: string;
  descripcion: string;
  unidad: string;
  umbralMinimo: number;
  umbralMaximo: number;
  activa: boolean;
  umbral: number;
  enAlerta: number;
  ultimaRevisionEn: Date | null;
}

export interface AlertaDelHistorial {
  id: string;
  alumnoId: string | null;
  alumnoNombre: string | null;
  evaluacionId: string | null;
  evaluacionNombre: string | null;
  cursoNombre: string | null;
  nivel: number;
  abiertaEn: Date;
  resueltaEn: Date | null;
  motivoCierre: MotivoCierre | null;
}

const ALERTAS_POR_PAGINA = 20;

export type CausaDeRevision = "revision" | "regla-apagada" | "cambio-de-numero";

export class AutomatizacionService {
  constructor(
    private readonly repo: AutomatizacionRepository,
    private readonly evaluadores: EvaluadoresDeReglas,
    private readonly unitOfWork: UnitOfWork,
    private readonly anuncios: Publicador<EventosAutomatizaciones & EventosCambios> = sinAnuncios(),
  ) {}

  // Revisa las reglas **enteras** (todos los alumnos) dentro de la transacción en curso. Cada regla toma su bloqueo, así dos
  // revisiones simultáneas van de a una. Con la regla apagada no se espera ninguna alerta (se cierran las abiertas).
  async evaluar(reglas: ReglaId[], tx: unknown, causa: CausaDeRevision = "revision", ahora: Date = new Date()): Promise<void> {
    const cambiadas: ReglaId[] = [];
    for (const regla of [...new Set(reglas)].sort()) {
      await this.repo.bloquearRegla(regla, tx);
      const config = await this.repo.obtenerConfig(regla, tx);
      const abiertas = await this.repo.findAbiertas(regla, tx);
      const { esperadas, poblacion } = config.activa ? await this.evaluadores[regla].evaluar(config.umbral, tx) : { esperadas: [], poblacion: new Set<string>() };
      const cambios = reconciliarAlertas({ abiertas, esperadas, poblacion, causa: config.activa ? causa : "regla-apagada", nuevoId: randomUUID });

      await this.repo.crearAlertas(
        cambios.abrir.map((a) => ({ id: a.id, regla, alumnoId: a.alumnoId, cursoId: a.cursoId, evaluacionId: a.evaluacionId ?? null, nivel: a.nivel, abiertaEn: ahora, resueltaEn: null, motivoCierre: null })),
        tx,
      );
      for (const { id, nivel } of cambios.actualizar) await this.repo.actualizarNivel(id, nivel, tx);
      await this.repo.cerrarAlertas(cambios.cerrar, ahora, tx);
      // Con la regla apagada no se revisó nada: la última revisión sigue siendo la de la última vez que estuvo encendida.
      if (config.activa) await this.repo.actualizarConfig(regla, { ultimaRevisionEn: ahora }, tx);
      if (cambios.abrir.length + cambios.actualizar.length + cambios.cerrar.length > 0) cambiadas.push(regla);
    }
    if (cambiadas.length > 0) {
      await this.anuncios.publicar("alertas.cambiaron", { reglaIds: cambiadas }, tx);
      await this.anuncios.publicar("datos.cambiaron", { dato: "automatizaciones", accion: "estado", ids: {} }, tx);
    }
  }

  // Revisión completa (al arrancar y a las 03:00): una transacción por regla, para no tener bloqueos largos.
  async evaluarTodas(ahora: Date = new Date()): Promise<void> {
    for (const regla of REGLA_IDS) await this.unitOfWork.runInTransaction((tx) => this.evaluar([regla], tx, "revision", ahora));
  }

  // El id que llega por la dirección: una regla que no existe es un 404.
  private reglaDe(id: string): ReglaId {
    if (!(REGLA_IDS as string[]).includes(id)) throw new EntityNotFoundError("Regla", id);
    return id as ReglaId;
  }

  private async conEstado(regla: ReglaId, tx?: unknown): Promise<ReglaConEstado> {
    const def = REGLAS[regla];
    const config = await this.repo.obtenerConfig(regla, tx);
    return {
      id: regla,
      nombre: def.nombre,
      descripcion: def.descripcion,
      unidad: def.unidad,
      umbralMinimo: def.umbralMinimo,
      umbralMaximo: def.umbralMaximo,
      activa: config.activa,
      umbral: config.umbral,
      enAlerta: await this.repo.contarAbiertas(regla, tx),
      ultimaRevisionEn: config.ultimaRevisionEn,
    };
  }

  async listar(): Promise<ReglaConEstado[]> {
    const reglas: ReglaConEstado[] = [];
    for (const regla of REGLA_IDS) reglas.push(await this.conEstado(regla));
    return reglas;
  }

  // Cambia el interruptor o el número y revisa la regla en el momento: apagarla cierra sus alertas, cambiar el número las
  // recalcula y encenderla las vuelve a abrir si siguen valiendo.
  async actualizar(reglaId: string, cambios: ActualizarAutomatizacionInput): Promise<ReglaConEstado> {
    const regla = this.reglaDe(reglaId);
    const def = REGLAS[regla];
    if (cambios.umbral !== undefined && (cambios.umbral < def.umbralMinimo || cambios.umbral > def.umbralMaximo)) {
      throw new ValidationError(`El número tiene que estar entre ${def.umbralMinimo} y ${def.umbralMaximo}`);
    }
    return this.unitOfWork.runInTransaction(async (tx) => {
      await this.repo.bloquearRegla(regla, tx);
      const antes = await this.repo.obtenerConfig(regla, tx);
      await this.repo.actualizarConfig(regla, { ...(cambios.activa !== undefined && { activa: cambios.activa }), ...(cambios.umbral !== undefined && { umbral: cambios.umbral }) }, tx);
      const seApaga = cambios.activa === false && antes.activa;
      const cambiaElNumero = cambios.umbral !== undefined && cambios.umbral !== antes.umbral;
      await this.evaluar([regla], tx, seApaga ? "regla-apagada" : cambiaElNumero ? "cambio-de-numero" : "revision");
      await this.anuncios.publicar("datos.cambiaron", { dato: "automatizaciones", accion: "edicion", ids: {} }, tx);
      return this.conEstado(regla, tx);
    });
  }

  // Historial permanente de la regla, las alertas más nuevas primero, de a 20.
  async historial(reglaId: string, pagina: number): Promise<{ alertas: AlertaDelHistorial[]; total: number; porPagina: number }> {
    const regla = this.reglaDe(reglaId);
    const { filas, total } = await this.repo.historial(regla, pagina, ALERTAS_POR_PAGINA);
    return {
      total,
      porPagina: ALERTAS_POR_PAGINA,
      alertas: filas.map((f) => ({ id: f.id, alumnoId: f.alumnoId, alumnoNombre: f.alumnoNombre, evaluacionId: f.evaluacionId, evaluacionNombre: f.evaluacionNombre, cursoNombre: f.cursoNombre, nivel: f.nivel, abiertaEn: f.abiertaEn, resueltaEn: f.resueltaEn, motivoCierre: f.motivoCierre })),
    };
  }
}
