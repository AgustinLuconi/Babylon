import { randomUUID } from "node:crypto";
import { ConflictError, EntityNotFoundError, ValidationError } from "../../core/errors";
import type { Publicador, UnitOfWork } from "../../core/ports";
import { sinAnuncios } from "../../core/eventos";
import type { CicloRepository } from "./ciclo.repository";
import type { Ciclo, CicloConCalendario, PausaDelCiclo } from "./ciclo.entity";
import { calendarioDelCiclo, validarFechasDelCiclo, validarPausa } from "./ciclo.calendario";
import { cicloSiempreAbierto, type VerificadorDeCiclo } from "./ciclo.guarda";
import type { CrearCicloInput, CrearPausaInput, EditarFechasInput, EditarPausaInput } from "./ciclo.schema";
import type { EventosCambios } from "../cambios/cambio.eventos";
import type { EventosCiclos } from "./ciclo.eventos";

export class CicloService {
  constructor(
    private readonly cicloRepo: CicloRepository,
    private readonly unitOfWork: UnitOfWork,
    private readonly anuncios: Publicador<EventosCiclos & EventosCambios> = sinAnuncios(),
    private readonly verificador: VerificadorDeCiclo = cicloSiempreAbierto(),
  ) {}

  // Cada ciclo con sus fechas ya resueltas (sin fechas cargadas rige el calendario por defecto) y sus pausas.
  async listarCiclos(): Promise<CicloConCalendario[]> {
    const ciclos = await this.cicloRepo.findAll();
    return Promise.all(ciclos.map(async (ciclo) => this.conCalendario(ciclo, await this.cicloRepo.findPausasByCicloId(ciclo.id))));
  }

  private conCalendario(ciclo: Ciclo, pausas: PausaDelCiclo[]): CicloConCalendario {
    const calendario = calendarioDelCiclo(ciclo);
    return { ...ciclo, inicio: new Date(`${calendario.inicio}T00:00:00.000Z`), fin: new Date(`${calendario.fin}T00:00:00.000Z`), pausas };
  }

  // Las operaciones del calendario toman el ciclo con FOR UPDATE (esperan a una asistencia que ya verificó el ciclo), y un
  // ciclo bloqueado las rechaza. Después validan con las reglas puras y anuncian el cambio dentro de la transacción.
  private async enElCalendario<T>(cicloId: string, trabajo: (ciclo: Ciclo, pausas: PausaDelCiclo[], tx: unknown) => Promise<T>): Promise<T> {
    return this.unitOfWork.runInTransaction(async (tx) => {
      await this.cicloRepo.bloquear(cicloId, tx);
      await this.verificador.verificarCicloAbierto(cicloId, tx);
      const ciclo = await this.cicloRepo.findById(cicloId, tx);
      if (!ciclo) throw new EntityNotFoundError("Ciclo", cicloId);
      const resultado = await trabajo(ciclo, await this.cicloRepo.findPausasByCicloId(cicloId, tx), tx);
      await this.anuncios.publicar("datos.cambiaron", { dato: "ciclos", accion: "edicion", ids: { cicloIds: [cicloId] } }, tx);
      return resultado;
    });
  }

  private pausaDelCiclo(pausas: PausaDelCiclo[], cicloId: string, pausaId: string): PausaDelCiclo {
    const pausa = pausas.find((p) => p.id === pausaId);
    if (!pausa || pausa.cicloId !== cicloId) throw new EntityNotFoundError("Pausa", pausaId);
    return pausa;
  }

  async editarFechas(id: string, datos: EditarFechasInput): Promise<CicloConCalendario> {
    return this.enElCalendario(id, async (ciclo, pausas, tx) => {
      const error = validarFechasDelCiclo({ ...calendarioDelCiclo({ anio: ciclo.anio, inicio: null, fin: null }, pausas), inicio: datos.inicio, fin: datos.fin });
      if (error) throw new ValidationError(error);
      const guardado = await this.cicloRepo.update(id, { ...ciclo, inicio: new Date(`${datos.inicio}T00:00:00.000Z`), fin: new Date(`${datos.fin}T00:00:00.000Z`) }, tx);
      return this.conCalendario(guardado, pausas);
    });
  }

  async agregarPausa(cicloId: string, datos: CrearPausaInput): Promise<PausaDelCiclo> {
    return this.enElCalendario(cicloId, async (ciclo, pausas, tx) => {
      const error = validarPausa(calendarioDelCiclo(ciclo), datos, calendarioDelCiclo(ciclo, pausas).pausas);
      if (error) throw new ValidationError(error);
      const pausa: PausaDelCiclo = { id: randomUUID(), cicloId, desde: new Date(`${datos.desde}T00:00:00.000Z`), hasta: new Date(`${datos.hasta}T00:00:00.000Z`), nombre: datos.nombre, tipo: datos.tipo };
      return this.cicloRepo.crearPausa(pausa, tx);
    });
  }

  async editarPausa(cicloId: string, pausaId: string, datos: EditarPausaInput): Promise<PausaDelCiclo> {
    return this.enElCalendario(cicloId, async (ciclo, pausas, tx) => {
      const actual = this.pausaDelCiclo(pausas, cicloId, pausaId);
      const [mia] = calendarioDelCiclo(ciclo, [actual]).pausas;
      const nueva = { desde: datos.desde ?? mia.desde, hasta: datos.hasta ?? mia.hasta, nombre: datos.nombre ?? actual.nombre };
      const otras = calendarioDelCiclo(ciclo, pausas.filter((p) => p.id !== pausaId)).pausas;
      const error = validarPausa(calendarioDelCiclo(ciclo), nueva, otras);
      if (error) throw new ValidationError(error);
      return this.cicloRepo.actualizarPausa(
        pausaId,
        {
          ...(datos.desde !== undefined && { desde: new Date(`${datos.desde}T00:00:00.000Z`) }),
          ...(datos.hasta !== undefined && { hasta: new Date(`${datos.hasta}T00:00:00.000Z`) }),
          ...(datos.nombre !== undefined && { nombre: datos.nombre }),
          ...(datos.tipo !== undefined && { tipo: datos.tipo }),
        },
        tx,
      );
    });
  }

  async eliminarPausa(cicloId: string, pausaId: string): Promise<void> {
    await this.enElCalendario(cicloId, async (_ciclo, pausas, tx) => {
      this.pausaDelCiclo(pausas, cicloId, pausaId);
      await this.cicloRepo.eliminarPausa(pausaId, tx);
    });
  }

  async buscarActivo(): Promise<Ciclo> {
    const activo = await this.cicloRepo.findActivo();
    if (!activo) {
      throw new EntityNotFoundError("Ciclo activo");
    }
    return activo;
  }

  async crearCiclo(datos: CrearCicloInput): Promise<Ciclo> {
    const existente = await this.cicloRepo.findByAnio(datos.anio);
    if (existente) {
      throw new ConflictError(`Ya existe un ciclo para el año ${datos.anio}`);
    }

    const ciclo: Ciclo = { id: randomUUID(), anio: datos.anio, activo: false, bloqueado: false, inicio: null, fin: null };
    const creado = await this.cicloRepo.create(ciclo);
    await this.anuncios.publicar("datos.cambiaron", { dato: "ciclos", accion: "alta", ids: { cicloIds: [creado.id] } });
    return creado;
  }

  // Un solo ciclo puede estar activo a la vez (define a qué ciclo se asocian
  // las altas nuevas de cursos/inscripciones) — desactivar todos los demás y
  // activar este es atómico para no dejar 0 o 2+ ciclos activos si algo falla.
  async marcarActivo(id: string): Promise<Ciclo> {
    return this.unitOfWork.runInTransaction((tx) => this.activarEnTransaccion(id, tx));
  }

  // Lo que hace `marcarActivo`, dentro de una transacción en curso (la usa también el asistente "Pasar de año"; las
  // transacciones no se anidan).
  async activarEnTransaccion(id: string, tx: unknown): Promise<Ciclo> {
    await this.cicloRepo.bloquear(id, tx);
    const ciclo = await this.cicloRepo.findById(id, tx);
    if (!ciclo) {
      throw new EntityNotFoundError("Ciclo", id);
    }
    if (ciclo.bloqueado) {
      throw new ConflictError(`El ciclo ${ciclo.anio} está bloqueado: desbloquealo antes de activarlo`);
    }
    await this.cicloRepo.desactivarTodos(tx);
    const activo = await this.cicloRepo.update(id, { ...ciclo, activo: true }, tx);
    await this.anuncios.publicar("ciclo.activado", { cicloId: id }, tx);
    // Cambia todo lo que muestran las pantallas: todas vuelven a pedir sus datos.
    await this.anuncios.publicar("datos.cambiaron", { dato: "ciclos", accion: "activacion", ids: { cicloIds: [id] } }, tx);
    return activo;
  }

  // Un ciclo bloqueado no admite escrituras de lo que le pertenece. El activo no se puede bloquear (el sistema se
  // quedaría sin poder inscribir): para cerrar un año se activa primero el siguiente. Repetir la acción no hace nada.
  async bloquearCiclo(id: string): Promise<Ciclo> {
    return this.unitOfWork.runInTransaction((tx) => this.bloquearEnTransaccion(id, tx));
  }

  async bloquearEnTransaccion(id: string, tx: unknown): Promise<Ciclo> {
    await this.cicloRepo.bloquear(id, tx);
    const ciclo = await this.cicloRepo.findById(id, tx);
    if (!ciclo) throw new EntityNotFoundError("Ciclo", id);
    if (ciclo.activo) throw new ConflictError(`El ciclo ${ciclo.anio} está activo: activá otro ciclo antes de bloquearlo`);
    if (ciclo.bloqueado) return ciclo;
    const bloqueado = await this.cicloRepo.update(id, { ...ciclo, bloqueado: true }, tx);
    await this.anuncios.publicar("datos.cambiaron", { dato: "ciclos", accion: "bloqueo", ids: { cicloIds: [id] } }, tx);
    return bloqueado;
  }

  async desbloquearCiclo(id: string): Promise<Ciclo> {
    return this.unitOfWork.runInTransaction(async (tx) => {
      await this.cicloRepo.bloquear(id, tx);
      const ciclo = await this.cicloRepo.findById(id, tx);
      if (!ciclo) throw new EntityNotFoundError("Ciclo", id);
      if (!ciclo.bloqueado) return ciclo;
      const desbloqueado = await this.cicloRepo.update(id, { ...ciclo, bloqueado: false }, tx);
      await this.anuncios.publicar("datos.cambiaron", { dato: "ciclos", accion: "desbloqueo", ids: { cicloIds: [id] } }, tx);
      return desbloqueado;
    });
  }
}
