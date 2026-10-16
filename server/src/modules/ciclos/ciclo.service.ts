import { randomUUID } from "node:crypto";
import { ConflictError, EntityNotFoundError } from "../../core/errors";
import type { Publicador, UnitOfWork } from "../../core/ports";
import { sinAnuncios } from "../../core/eventos";
import type { CicloRepository } from "./ciclo.repository";
import type { Ciclo } from "./ciclo.entity";
import type { CrearCicloInput } from "./ciclo.schema";
import type { EventosCiclos } from "./ciclo.eventos";

export class CicloService {
  constructor(
    private readonly cicloRepo: CicloRepository,
    private readonly unitOfWork: UnitOfWork,
    private readonly anuncios: Publicador<EventosCiclos> = sinAnuncios(),
  ) {}

  async listarCiclos(): Promise<Ciclo[]> {
    return this.cicloRepo.findAll();
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

    const ciclo: Ciclo = { id: randomUUID(), anio: datos.anio, activo: false };
    return this.cicloRepo.create(ciclo);
  }

  // Un solo ciclo puede estar activo a la vez (define a qué ciclo se asocian
  // las altas nuevas de cursos/inscripciones) — desactivar todos los demás y
  // activar este es atómico para no dejar 0 o 2+ ciclos activos si algo falla.
  async marcarActivo(id: string): Promise<Ciclo> {
    return this.unitOfWork.runInTransaction(async (tx) => {
      const ciclo = await this.cicloRepo.findById(id, tx);
      if (!ciclo) {
        throw new EntityNotFoundError("Ciclo", id);
      }
      await this.cicloRepo.desactivarTodos(tx);
      const activo = await this.cicloRepo.update(id, { ...ciclo, activo: true }, tx);
      await this.anuncios.publicar("ciclo.activado", { cicloId: id }, tx);
      return activo;
    });
  }
}
