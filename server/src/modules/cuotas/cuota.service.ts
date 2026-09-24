import { randomUUID } from "node:crypto";
import { AuthorizationError, ConflictError, EntityNotFoundError, ValidationError } from "../../core/errors";
import type { Rol, UnitOfWork } from "../../core/ports";
import type { AlumnoRepository } from "../alumnos/alumno.repository";
import type { Alumno } from "../alumnos/alumno.entity";
import type { CicloRepository } from "../ciclos/ciclo.repository";
import type { ConfiguracionRepository } from "../configuraciones/configuracion.repository";
import type { CuotaRepository } from "./cuota.repository";
import type { Cuota } from "./cuota.entity";
import type { Pago } from "./pago.entity";
import type { RegistrarPagoInput } from "./cuota.schema";
import { esMesLectivo, inicioDeHoyUtc, PORCENTAJE_DESCUENTO_HERMANOS, vencimientoDelMes } from "./cuota.calendario";

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
    private readonly cicloRepo: CicloRepository,
    private readonly configuracionRepo: ConfiguracionRepository,
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
    // La fecha llega como calendario (AAAA-MM-DD, medianoche UTC, igual que el
    // resto de las fechas calendario); sin fecha se usa el instante actual.
    const fechaPago = datos.fechaPago ? new Date(`${datos.fechaPago}T00:00:00.000Z`) : new Date();
    if (fechaPago.getTime() > Date.now() + 24 * 60 * 60 * 1000) {
      throw new ValidationError("La fecha de pago no puede ser futura");
    }
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
          fechaPago,
          metodo: datos.metodo,
          monto: cuota.montoFinal,
          registradoPor: datos.registradoPor,
          notas: datos.notas || null,
        };

        await this.cuotaRepo.registrarPago(pago, tx);
        await this.cuotaRepo.update(cuota.id, { ...cuota, estado: "pagada" }, tx);
        pagosRegistrados.push(pago);
      }

      return pagosRegistrados;
    });
  }

  // ── Generación automática de cuotas ──────────────────────────────────────
  // Una cuota por alumno activo del ciclo activo y por mes lectivo (marzo a
  // noviembre), con el valor global de Configuración, ya con el descuento por
  // hermanos si corresponde. Nace "pendiente" y vence el día 10. Es idempotente
  // (una sola cuota por alumno y mes), así que se puede correr las veces que haga
  // falta.

  // Datos comunes a toda la generación del mes de `hoy`, o null si no hay nada
  // que generar: mes fuera del ciclo lectivo, sin ciclo activo de este año, o
  // sin valor de cuota cargado.
  private async contextoDeGeneracion(hoy: Date, tx?: unknown) {
    const mes = hoy.getMonth() + 1;
    const anio = hoy.getFullYear();
    if (!esMesLectivo(mes)) return null;
    const ciclo = await this.cicloRepo.findActivo(tx);
    if (!ciclo || ciclo.anio !== anio) return null;
    const { valorCuota } = await this.configuracionRepo.obtener(tx);
    if (valorCuota === null) return null;
    return { mes, anio, ciclo, valorCuota, vencimiento: vencimientoDelMes(mes, anio, hoy) };
  }

  private nuevaCuota(alumno: Alumno, ctx: { mes: number; anio: number; valorCuota: number; vencimiento: Date }): Cuota {
    const descuento = alumno.aplicaDescuentoHermanos ? Math.round((ctx.valorCuota * PORCENTAJE_DESCUENTO_HERMANOS) / 100) : 0;
    return {
      id: randomUUID(),
      alumnoId: alumno.id,
      mes: ctx.mes,
      anio: ctx.anio,
      montoBase: ctx.valorCuota,
      descuento,
      montoFinal: ctx.valorCuota - descuento,
      vencimiento: ctx.vencimiento,
      estado: "pendiente",
    };
  }

  // Al inscribir: crea la cuota del mes de inscripción, si corresponde.
  async generarCuotaInicial(alumno: Alumno, hoy: Date = new Date(), tx?: unknown): Promise<Cuota | null> {
    const ctx = await this.contextoDeGeneracion(hoy, tx);
    if (!ctx || alumno.estado !== "activo") return null;
    const existentes = await this.cuotaRepo.findByAlumnoId(alumno.id, tx);
    if (existentes.some((c) => c.mes === ctx.mes && c.anio === ctx.anio)) return null;
    return this.cuotaRepo.create(this.nuevaCuota(alumno, ctx), tx);
  }

  // Cuota del mes para todos los alumnos activos del ciclo activo que todavía no
  // la tengan. Devuelve cuántas creó.
  async generarCuotasDelMes(hoy: Date = new Date()): Promise<number> {
    return this.unitOfWork.runInTransaction(async (tx) => {
      const ctx = await this.contextoDeGeneracion(hoy, tx);
      if (!ctx) return 0;

      const conCuota = new Set((await this.cuotaRepo.findByMesYAnio(ctx.mes, ctx.anio, tx)).map((c) => c.alumnoId));
      const inscripciones = await this.cicloRepo.findInscripcionesByCicloId(ctx.ciclo.id, tx);
      const alumnoIds = [...new Set(inscripciones.map((i) => i.alumnoId))].filter((id) => !conCuota.has(id));

      let creadas = 0;
      for (const alumnoId of alumnoIds) {
        const alumno = await this.alumnoRepo.findById(alumnoId, tx);
        if (!alumno || alumno.estado !== "activo") continue;
        await this.cuotaRepo.create(this.nuevaCuota(alumno, ctx), tx);
        creadas++;
      }
      return creadas;
    });
  }

  // Pasa a "vencida" las cuotas pendientes cuyo vencimiento ya pasó.
  async marcarVencidas(hoy: Date = new Date()): Promise<number> {
    return this.cuotaRepo.marcarVencidas(inicioDeHoyUtc(hoy));
  }

  // Tarea periódica: marca vencidas y genera las cuotas del mes que falten.
  async mantenerCuotas(hoy: Date = new Date()): Promise<{ vencidas: number; generadas: number }> {
    const vencidas = await this.marcarVencidas(hoy);
    const generadas = await this.generarCuotasDelMes(hoy);
    return { vencidas, generadas };
  }
}
