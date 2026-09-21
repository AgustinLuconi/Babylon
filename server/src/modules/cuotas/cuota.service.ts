import { randomUUID } from "node:crypto";
import { AuthorizationError, ConflictError, EntityNotFoundError } from "../../core/errors";
import type { Rol, UnitOfWork } from "../../core/ports";
import type { AlumnoRepository } from "../alumnos/alumno.repository";
import type { CuotaRepository } from "./cuota.repository";
import type { Cuota } from "./cuota.entity";
import type { Pago } from "./pago.entity";
import type { RegistrarPagoInput } from "./cuota.schema";

export interface Solicitante {
  rol: Rol;
  padreId?: string;
}

export interface CuotaConFechaPago extends Cuota {
  fechaPago?: Date;
}

export class CuotaService {
  constructor(
    private readonly cuotaRepo: CuotaRepository,
    private readonly alumnoRepo: AlumnoRepository,
    private readonly unitOfWork: UnitOfWork,
  ) {}

  // Cada cuota pagada incluye la fecha en que se registró el pago ("Pagada el ..."
  // en la pantalla del padre), que vive en Pago y no en Cuota.
  async listarPorAlumno(alumnoId: string, solicitante: Solicitante): Promise<CuotaConFechaPago[]> {
    if (solicitante.rol === "padre") {
      const alumno = await this.alumnoRepo.findById(alumnoId);
      if (!alumno || alumno.padreId !== solicitante.padreId) {
        throw new AuthorizationError("Un padre solo puede ver los datos de sus propios hijos");
      }
    }
    const cuotas = await this.cuotaRepo.findByAlumnoId(alumnoId);
    const pagos = cuotas.length > 0 ? await this.cuotaRepo.findPagosByCuotaIds(cuotas.map((c) => c.id)) : [];
    const fechaPagoPorCuota = new Map(pagos.map((p) => [p.cuotaId, p.fechaPago]));
    return cuotas.map((c) => ({ ...c, fechaPago: fechaPagoPorCuota.get(c.id) }));
  }

  async listarTodas(): Promise<Cuota[]> {
    return this.cuotaRepo.findAll();
  }

  async listarPagos(): Promise<Pago[]> {
    return this.cuotaRepo.findAllPagos();
  }

  async registrarPago(datos: RegistrarPagoInput): Promise<Pago[]> {
    return this.unitOfWork.runInTransaction(async (tx) => {
      const pagosRegistrados: Pago[] = [];

      for (const cuotaId of datos.cuotaIds) {
        const cuota = await this.cuotaRepo.findById(cuotaId, tx);
        if (!cuota) {
          throw new EntityNotFoundError("Cuota", cuotaId);
        }
        if (cuota.estado === "pagada") {
          throw new ConflictError(`La cuota ${cuotaId} ya fue pagada`);
        }

        const pago: Pago = {
          id: randomUUID(),
          cuotaId: cuota.id,
          fechaPago: new Date(),
          metodo: datos.metodo,
          monto: cuota.montoFinal,
          registradoPor: datos.registradoPor,
        };

        await this.cuotaRepo.registrarPago(pago, tx);
        await this.cuotaRepo.update(cuota.id, { ...cuota, estado: "pagada" }, tx);
        pagosRegistrados.push(pago);
      }

      return pagosRegistrados;
    });
  }
}
