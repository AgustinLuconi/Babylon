import { randomUUID } from "node:crypto";
import { sinAnuncios } from "../../core/eventos";
import type { Publicador, UnitOfWork } from "../../core/ports";
import type { EventosCambios } from "../cambios/cambio.eventos";
import { REGLA_IDS, type EvaluadoresDeReglas, type ReglaId } from "./automatizacion.entity";
import type { EventosAutomatizaciones } from "./automatizacion.eventos";
import { reconciliarAlertas } from "./automatizacion.reconciliar";
import type { AutomatizacionRepository } from "./automatizacion.repository";

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
        cambios.abrir.map((a) => ({ id: a.id, regla, alumnoId: a.alumnoId, cursoId: a.cursoId, nivel: a.nivel, abiertaEn: ahora, resueltaEn: null, motivoCierre: null })),
        tx,
      );
      for (const { id, nivel } of cambios.actualizar) await this.repo.actualizarNivel(id, nivel, tx);
      await this.repo.cerrarAlertas(cambios.cerrar, ahora, tx);
      await this.repo.actualizarConfig(regla, { ultimaRevisionEn: ahora }, tx);
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
}
