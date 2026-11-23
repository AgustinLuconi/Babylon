import { randomUUID } from "node:crypto";
import { ConflictError, EntityNotFoundError, ValidationError } from "../../core/errors";
import { sinAnuncios } from "../../core/eventos";
import { hoyISOEnArgentina } from "../../core/fechas";
import type { Publicador, UnitOfWork } from "../../core/ports";
import type { AlumnoRepository } from "../alumnos/alumno.repository";
import type { AlumnoService, MovimientoDePase } from "../alumnos/alumno.service";
import type { EventosCambios } from "../cambios/cambio.eventos";
import type { Curso } from "../cursos/curso.entity";
import type { CursoRepository } from "../cursos/curso.repository";
import type { Ciclo } from "./ciclo.entity";
import { cicloSiempreAbierto, type VerificadorDeCiclo } from "./ciclo.guarda";
import type { CicloRepository } from "./ciclo.repository";
import type { CicloService } from "./ciclo.service";
import { planificarPaseDeAnio, type CursoOrigen, type DatosDelPlan, type Plan } from "./paseDeAnio.plan";
import type { PaseDeAnioInput } from "./paseDeAnio.schema";

export interface VistaPrevia extends Plan {
  origenAnio: number;
  destinoAnio: number;
  destinoNuevo: boolean;
  origen: CursoOrigen[];
  cursosDestino: { id: string; nombre: string }[];
  totales: { pasan: number; egresan: number; noContinuan: number; cursosCopiados: number };
  // El año del origen todavía no terminó: el curso actual de los alumnos que pasan cambia desde ya.
  advertenciaAnioEnCurso: boolean;
}

export interface Resumen {
  pasan: number;
  egresan: number;
  noContinuan: number;
  cursosCreados: number;
  cursosReutilizados: number;
  yaInscriptos: number;
  destinoCicloId: string;
}

interface Cargado {
  origen: Ciclo;
  destino: Ciclo | null; // null: el año de destino todavía no existe (se crea al confirmar)
  destinoAnio: number;
  cursosOrigen: Curso[];
  datos: DatosDelPlan;
}

// Asistente "Pasar de año" (solo administrador): la vista previa no escribe nada; la confirmación aplica todo en una sola
// transacción (todo o nada). Las reglas de qué hacer con cada alumno están en `paseDeAnio.plan` (pura).
export class PaseDeAnioService {
  constructor(
    private readonly cicloService: CicloService,
    private readonly cicloRepo: CicloRepository,
    private readonly cursoRepo: CursoRepository,
    private readonly alumnoRepo: AlumnoRepository,
    private readonly alumnoService: AlumnoService,
    private readonly unitOfWork: UnitOfWork,
    private readonly anuncios: Publicador<EventosCambios> = sinAnuncios(),
    private readonly verificador: VerificadorDeCiclo = cicloSiempreAbierto(),
  ) {}

  // Lee todo lo que el plan necesita y valida los ciclos (distintos y sin bloquear).
  private async cargar(input: PaseDeAnioInput, tx?: unknown): Promise<Cargado> {
    const origen = await this.cicloRepo.findById(input.origenId, tx);
    if (!origen) throw new EntityNotFoundError("Ciclo", input.origenId);
    let destino: Ciclo | null;
    if ("cicloId" in input.destino) {
      destino = await this.cicloRepo.findById(input.destino.cicloId, tx);
      if (!destino) throw new EntityNotFoundError("Ciclo", input.destino.cicloId);
    } else {
      destino = await this.cicloRepo.findByAnio(input.destino.anio, tx);
    }
    const destinoAnio = destino?.anio ?? (input.destino as { anio: number }).anio;
    if (destino?.id === origen.id || destinoAnio === origen.anio) {
      throw new ValidationError("El ciclo de origen y el de destino tienen que ser distintos");
    }
    for (const ciclo of [origen, destino]) {
      if (ciclo?.bloqueado) throw new ConflictError(`El ciclo ${ciclo.anio} está bloqueado. Pedile al administrador que lo desbloquee.`);
    }

    const cursosOrigen = await this.cursoRepo.findByCicloId(origen.id, tx);
    const inscripciones = await this.cicloRepo.findInscripcionesByCicloId(origen.id, tx);
    const alumnos = new Map<string, { id: string; nombre: string; cursoActualId: string | null; activo: boolean }>();
    // Todos los alumnos en una sola consulta (no una por inscripción).
    for (const a of await this.alumnoRepo.findByIds([...new Set(inscripciones.map((i) => i.alumnoId))], tx)) {
      alumnos.set(a.id, { id: a.id, nombre: `${a.nombre} ${a.apellido}`, cursoActualId: a.cursoId ?? null, activo: a.estado === "activo" });
    }
    const origenPlan: CursoOrigen[] = cursosOrigen.map((curso) => ({
      id: curso.id,
      nombre: curso.nombre,
      alumnos: inscripciones
        .filter((i) => i.cursoId === curso.id)
        .map((i) => alumnos.get(i.alumnoId))
        .filter((a): a is NonNullable<typeof a> => !!a && a.activo)
        .map(({ id, nombre, cursoActualId }) => ({ id, nombre, cursoActualId })),
    }));

    const cursosDestino = destino ? await this.cursoRepo.findByCicloId(destino.id, tx) : [];
    const yaInscriptos = new Map<string, string>();
    if (destino) {
      const nombres = new Map(cursosDestino.map((c) => [c.id, c.nombre]));
      for (const i of await this.cicloRepo.findInscripcionesByCicloId(destino.id, tx)) {
        if (!nombres.has(i.cursoId)) nombres.set(i.cursoId, (await this.cursoRepo.findById(i.cursoId, tx))?.nombre ?? i.cursoId);
        yaInscriptos.set(i.alumnoId, nombres.get(i.cursoId) as string);
      }
    }
    const datos: DatosDelPlan = {
      origen: origenPlan,
      cursosDestino: cursosDestino.map((c) => ({ id: c.id, nombre: c.nombre })),
      yaInscriptos,
      copiar: input.copiarCursoIds,
      decisiones: input.cursos,
    };
    return { origen, destino, destinoAnio, cursosOrigen, datos };
  }

  async vistaPrevia(input: PaseDeAnioInput): Promise<VistaPrevia> {
    const { origen, destino, destinoAnio, datos } = await this.cargar(input);
    const plan = planificarPaseDeAnio(datos);
    return {
      ...plan,
      origenAnio: origen.anio,
      destinoAnio,
      destinoNuevo: destino === null,
      origen: datos.origen,
      cursosDestino: datos.cursosDestino,
      totales: {
        pasan: plan.movimientos.filter((m) => m.destino.tipo === "curso" || m.destino.tipo === "copia").length,
        egresan: plan.movimientos.filter((m) => m.destino.tipo === "egresan").length,
        noContinuan: plan.movimientos.filter((m) => m.destino.tipo === "no-continuan").length,
        cursosCopiados: plan.copias.length,
      },
      advertenciaAnioEnCurso: hoyISOEnArgentina() < `${origen.anio}-12-01`,
    };
  }

  async confirmar(input: PaseDeAnioInput): Promise<Resumen> {
    return this.unitOfWork.runInTransaction(async (tx) => {
      // Los ciclos se toman primero (en orden de id): activar, bloquear y escribir en ellos se hacen de a uno.
      const ids = [input.origenId, ...("cicloId" in input.destino ? [input.destino.cicloId] : [])];
      for (const id of [...new Set(ids)].sort()) await this.cicloRepo.bloquear(id, tx);

      const { origen, destino, destinoAnio, cursosOrigen, datos } = await this.cargar(input, tx);
      const plan = planificarPaseDeAnio(datos);
      if (plan.invalidos.length > 0) throw new ValidationError(`El pedido nombra cursos que no existen: ${plan.invalidos.join(", ")}`);
      if (plan.cursosSinDecision.length > 0) {
        const nombres = plan.cursosSinDecision.map((id) => datos.origen.find((c) => c.id === id)?.nombre ?? id);
        throw new ValidationError(`Falta decidir a dónde van los alumnos de: ${nombres.join(", ")}`, { cursosSinDecision: plan.cursosSinDecision });
      }

      let destinoCiclo = destino;
      if (!destinoCiclo) {
        destinoCiclo = await this.cicloRepo.create({ id: randomUUID(), anio: destinoAnio, activo: false, bloqueado: false, inicio: null, fin: null }, tx);
        await this.anuncios.publicar("datos.cambiaron", { dato: "ciclos", accion: "alta", ids: { cicloIds: [destinoCiclo.id] } }, tx);
      }
      await this.verificador.verificarCicloAbierto(destinoCiclo.id, tx);

      // Cursos: se copian con sus horarios; si el destino ya tiene uno con el mismo nombre se usa tal cual.
      const copiaDe = new Map<string, string>();
      let cursosCreados = 0;
      for (const copia of plan.copias) {
        if (copia.reutilizaCursoId) {
          copiaDe.set(copia.cursoOrigenId, copia.reutilizaCursoId);
          continue;
        }
        const cursoOrigen = cursosOrigen.find((c) => c.id === copia.cursoOrigenId) as Curso;
        const nuevo: Curso = { ...cursoOrigen, id: randomUUID(), cicloId: destinoCiclo.id, estado: "activo" };
        await this.cursoRepo.create(nuevo, tx);
        for (const h of await this.cursoRepo.findHorariosByCursoId(cursoOrigen.id, tx)) {
          await this.cursoRepo.agregarHorario({ id: randomUUID(), cursoId: nuevo.id, diaSemana: h.diaSemana, horaInicio: h.horaInicio, horaFin: h.horaFin }, tx);
        }
        copiaDe.set(copia.cursoOrigenId, nuevo.id);
        cursosCreados++;
      }
      if (cursosCreados > 0) {
        await this.anuncios.publicar("datos.cambiaron", { dato: "cursos", accion: "alta", ids: { cursoIds: [...copiaDe.values()] } }, tx);
      }

      const cicloId = destinoCiclo.id;
      const movimientos: MovimientoDePase[] = plan.movimientos.map(({ alumnoId, destino: d }) => {
        if (d.tipo === "curso") return { alumnoId, destino: { tipo: "pasa", cursoId: d.cursoId, cicloId } };
        if (d.tipo === "copia") return { alumnoId, destino: { tipo: "pasa", cursoId: copiaDe.get(d.copiaDe) as string, cicloId } };
        return { alumnoId, destino: { tipo: d.tipo === "egresan" ? "egresa" : "no-continua" } };
      });
      await this.alumnoService.registrarPaseDeAnio(movimientos, cicloId, tx);

      // El destino se activa DESPUÉS de mover a los alumnos: cuando las reglas de automatizaciones lo ven activo, los alumnos que
      // pasan ya están inscriptos en él y su deuda sigue igual (las alertas y los avisos no se cierran y se vuelven a abrir). El
      // recálculo de descuentos no depende de esto: escribe la marca en la inscripción del ciclo de destino.
      if (input.cierre?.activarDestino) await this.cicloService.activarEnTransaccion(destinoCiclo.id, tx);

      if (input.cierre?.bloquearOrigen) await this.cicloService.bloquearEnTransaccion(origen.id, tx);

      return {
        pasan: movimientos.filter((m) => m.destino.tipo === "pasa").length,
        egresan: movimientos.filter((m) => m.destino.tipo === "egresa").length,
        noContinuan: movimientos.filter((m) => m.destino.tipo === "no-continua").length,
        cursosCreados,
        cursosReutilizados: plan.copias.length - cursosCreados,
        yaInscriptos: plan.yaInscriptos.length,
        destinoCicloId: cicloId,
      };
    });
  }
}
