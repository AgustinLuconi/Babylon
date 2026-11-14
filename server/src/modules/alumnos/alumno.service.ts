import { randomUUID } from "node:crypto";
import { AuthorizationError, ConflictError, EntityNotFoundError, ValidationError } from "../../core/errors";
import type { Publicador, UnitOfWork } from "../../core/ports";
import { soloPresentes } from "../../core/cambios";
import { hoyISOEnArgentina } from "../../core/fechas";
import { sinAnuncios } from "../../core/eventos";
import { cicloSiempreAbierto, type VerificadorDeCiclo } from "../ciclos/ciclo.guarda";
import type { CicloRepository } from "../ciclos/ciclo.repository";
import type { CuotaService } from "../cuotas/cuota.service";
import type { Curso } from "../cursos/curso.entity";
import type { CursoRepository } from "../cursos/curso.repository";
import type { PadreRepository } from "../padres/padre.repository";
import type { PadreService } from "../padres/padre.service";
import type { Padre } from "../padres/padre.entity";
import type { ProfesorRepository } from "../profesores/profesor.repository";
import type { AlumnoRepository } from "./alumno.repository";
import type { Alumno, VinculoResponsable } from "./alumno.entity";
import type { DatoFaltante } from "./alumno.incompleto";
import type { ActualizarAlumnoInput, NuevoAlumnoInput, ResponsableInput } from "./alumno.schema";
import type { EventosCambios } from "../cambios/cambio.eventos";
import type { CambioDeDescuento, EventosAlumnos } from "./alumno.eventos";
import { alumnosConDescuento, correccionesDeDescuento, type CausaDescuento } from "./alumno.hermanos";

export interface HijoConCurso extends Alumno {
  cursoNombre: string | null;
  cursoNivel: string | null;
  profesorNombre: string | null;
}

// Resultado de resolver quién es el responsable de un alumno (ver `resolverResponsable`).
interface ResponsableResuelto {
  padre: Padre;
  vinculo: VinculoResponsable;
  // Nombre y apellido que le corresponden al alumno: con un responsable "propio" que ya existía, manda la ficha.
  nombre: string;
  apellido: string;
}

// Menor de 18 años a hoy (hora de Argentina); la fecha de nacimiento se guarda a medianoche UTC.
function esMenorDe18(nacimiento: Date): boolean {
  const [anio, mes, dia] = hoyISOEnArgentina().split("-").map(Number);
  const mayoriaDeEdad = Date.UTC(nacimiento.getUTCFullYear() + 18, nacimiento.getUTCMonth(), nacimiento.getUTCDate());
  return Date.UTC(anio, mes - 1, dia) < mayoriaDeEdad;
}

// Para comparar nombres sin mirar mayúsculas, tildes ni espacios de más.
const normalizarNombre = (nombre: string, apellido: string) =>
  `${nombre} ${apellido}`.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().replace(/\s+/g, " ").trim();

export class AlumnoService {
  constructor(
    private readonly alumnoRepo: AlumnoRepository,
    private readonly cursoRepo: CursoRepository,
    private readonly profesorRepo: ProfesorRepository,
    private readonly cicloRepo: CicloRepository,
    private readonly padreRepo: PadreRepository,
    private readonly padreService: PadreService,
    private readonly cuotaService: CuotaService,
    private readonly unitOfWork: UnitOfWork,
    private readonly anuncios: Publicador<EventosAlumnos & EventosCambios> = sinAnuncios(),
    private readonly verificador: VerificadorDeCiclo = cicloSiempreAbierto(),
  ) {}

  // Inscribir o cambiar de curso solo admite cursos del ciclo activo (y, por coherencia, de un ciclo no bloqueado).
  private async exigirCursoDelCicloActivo(curso: Curso, tx: unknown): Promise<void> {
    const activo = await this.cicloRepo.findActivo(tx);
    if (!activo) throw new ValidationError("No hay un ciclo activo: activá un ciclo antes de inscribir o cambiar de curso");
    if (curso.cicloId !== activo.id) {
      throw new ValidationError(`El curso "${curso.nombre}" no es del ciclo activo (${activo.anio}): solo se puede elegir un curso del ciclo activo`);
    }
    await this.verificador.verificarCicloAbierto(curso.cicloId, tx);
  }

  async listarAlumnos(): Promise<Alumno[]> {
    return this.alumnoRepo.findAll();
  }

  // Para el filtro y la marca de Alumnos: { [alumnoId]: lo que le falta }.
  async listarIncompletos(): Promise<Record<string, DatoFaltante[]>> {
    const incompletos = await this.alumnoRepo.findIncompletos();
    return Object.fromEntries(incompletos.map((a) => [a.alumnoId, a.faltan]));
  }

  async listarPorPadre(padreId: string): Promise<Alumno[]> {
    return this.alumnoRepo.findByPadreId(padreId);
  }

  // Vista enriquecida para el dashboard del padre — el rol padre no tiene
  // acceso a /api/cursos ni /api/profesores (son admin/secretario/profesor),
  // así que el nombre de curso/nivel/profesor se resuelve acá y se devuelve
  // ya embebido, sin abrir esos endpoints a un rol que solo debe ver lo suyo.
  async listarPorPadreConCurso(padreId: string): Promise<HijoConCurso[]> {
    const alumnos = await this.alumnoRepo.findByPadreId(padreId);
    return Promise.all(
      alumnos.map(async (alumno) => {
        const curso = alumno.cursoId ? await this.cursoRepo.findById(alumno.cursoId) : null;
        const profesor = curso ? await this.profesorRepo.findById(curso.profesorId) : null;
        return {
          ...alumno,
          cursoNombre: curso?.nombre ?? null,
          cursoNivel: curso?.nivel ?? null,
          profesorNombre: profesor ? `${profesor.nombre} ${profesor.apellido}` : null,
        };
      }),
    );
  }

  // Vía Inscripcion (historial real), no `Alumno.cursoId` — un alumno
  // reinscripto en un ciclo posterior sigue apareciendo en la nómina del
  // ciclo histórico donde realmente cursó.
  async listarPorCiclo(cicloId: string): Promise<Alumno[]> {
    const inscripciones = await this.cicloRepo.findInscripcionesByCicloId(cicloId);
    const alumnos = await Promise.all(inscripciones.map((i) => this.alumnoRepo.findById(i.alumnoId)));
    return alumnos.filter((a): a is Alumno => a !== null);
  }

  async listarPorCurso(cursoId: string, profesorId?: string): Promise<Alumno[]> {
    if (profesorId) {
      const curso = await this.cursoRepo.findById(cursoId);
      if (!curso) {
        throw new EntityNotFoundError("Curso", cursoId);
      }
      if (curso.profesorId !== profesorId) {
        throw new AuthorizationError("Un profesor solo puede ver la nómina de sus propios cursos");
      }
      // La nómina con la que el profesor trabaja (asistencia, notas, observaciones): solo alumnos activos. Un alumno
      // dado de baja deja de aparecer; administración y secretaría siguen viendo el curso completo.
      return (await this.alumnoRepo.findByCursoId(cursoId)).filter((a) => a.estado === "activo");
    }

    return this.alumnoRepo.findByCursoId(cursoId);
  }

  // Quién es el responsable de un alumno, dentro de una transacción en curso. `alumno` son los datos de la persona que
  // se inscribe (o que ya está inscripta, con `alumnoId`): se usan cuando es responsable de sí misma. `nivelDelCurso` es el
  // del curso al que va (o en el que está): sin fecha de nacimiento, solo un curso de adultos admite "propio".
  private async resolverResponsable(
    responsable: ResponsableInput,
    alumno: { nombre: string; apellido: string; dni?: string; fechaNacimiento?: Date },
    alumnoId: string | null,
    nivelDelCurso: string | null,
    tx: unknown,
  ): Promise<ResponsableResuelto> {
    if (responsable.tipo === "existente") {
      const padre = await this.padreRepo.findById(responsable.padreId, tx);
      if (!padre) throw new EntityNotFoundError("Padre", responsable.padreId);
      return { padre, vinculo: responsable.vinculo, nombre: alumno.nombre, apellido: alumno.apellido };
    }
    if (responsable.tipo === "nuevo") {
      const { padre } = await this.padreService.crearFichaEnTransaccion(responsable.datos, tx);
      return { padre, vinculo: responsable.vinculo, nombre: alumno.nombre, apellido: alumno.apellido };
    }

    // Responsable de sí mismo.
    if (alumno.fechaNacimiento && esMenorDe18(alumno.fechaNacimiento)) {
      const mensaje = "Un menor de 18 años no puede ser responsable de sí mismo";
      throw new ValidationError(mensaje, { fechaNacimiento: [mensaje] });
    }
    if (!alumno.fechaNacimiento && !nivelDelCurso?.startsWith("adults_")) {
      const mensaje = "Sin la fecha de nacimiento, solo un curso de adultos admite que el alumno sea responsable de sí mismo";
      throw new ValidationError(mensaje, { fechaNacimiento: [mensaje] });
    }
    const existente = alumno.dni ? await this.padreRepo.findByDni(alumno.dni, tx) : null;
    if (existente) {
      // La ficha de esa persona ya existe (por ejemplo una mamá que figura por su hijo): se reutiliza y manda ella; lo que
      // se escribió solo completa lo que le faltaba. Una ficha tiene a lo sumo un alumno "propio".
      const otros = (await this.alumnoRepo.findByPadreId(existente.id, tx)).filter(
        (a) => a.id !== alumnoId && a.vinculoResponsable === "propio",
      );
      if (otros.length > 0) throw new ConflictError("Esa persona ya figura como alumna de sí misma");
      const faltantes = soloPresentes({
        telefono: existente.telefono ? undefined : responsable.telefono,
        email: existente.email || !responsable.email ? undefined : responsable.email,
      });
      const padre = Object.keys(faltantes).length > 0 ? await this.padreRepo.actualizarParcial(existente.id, faltantes, tx) : existente;
      return { padre, vinculo: "propio", nombre: padre.nombre, apellido: padre.apellido };
    }
    const { padre } = await this.padreService.crearFichaEnTransaccion(
      {
        nombre: alumno.nombre,
        apellido: alumno.apellido,
        dni: alumno.dni,
        telefono: responsable.telefono,
        email: responsable.email,
      },
      tx,
    );
    return { padre, vinculo: "propio", nombre: alumno.nombre, apellido: alumno.apellido };
  }

  // Descuento por hermanos: vuelve a calcular la marca de los alumnos activos de esas familias (regla única en
  // `alumno.hermanos`) y la guarda en el alumno y en su inscripción del ciclo activo (si no tiene, se omite). Las cuotas ya
  // generadas no se tocan: la generación de las próximas lee esta marca. Las fichas se bloquean en orden de id y, para que
  // dos cambios simultáneos en una misma familia no se traben, quien llama las bloquea ANTES de tocar ningún alumno.
  // Devuelve los ids de los alumnos cuya marca cambió.
  private async recalcularDescuentos(
    padreIds: (string | undefined)[],
    causa: CausaDescuento,
    alumnoDeLaCausaId: string,
    tx: unknown,
  ): Promise<string[]> {
    const familias = await this.bloquearFamilias(padreIds, tx);
    const cicloActivo = await this.cicloRepo.findActivo(tx);
    const cambios: CambioDeDescuento[] = [];
    for (const padreId of familias) {
      const hermanos = await this.alumnoRepo.findByPadreId(padreId, tx);
      for (const { alumnoId, aplica } of correccionesDeDescuento(hermanos)) {
        await this.alumnoRepo.actualizarParcial(alumnoId, { aplicaDescuentoHermanos: aplica }, tx);
        if (cicloActivo && (await this.cicloRepo.findInscripcionByAlumnoYCiclo(alumnoId, cicloActivo.id, tx))) {
          await this.cicloRepo.actualizarInscripcion(alumnoId, cicloActivo.id, { aplicaDescuentoHermanos: aplica }, tx);
        }
        cambios.push({ alumnoId, aplica, causa, alumnoDeLaCausaId });
      }
    }
    if (cambios.length > 0) await this.anuncios.publicar("alumnos.descuentoCambio", { cambios }, tx);
    return cambios.map((c) => c.alumnoId);
  }

  // Señal en vivo de los hermanos cuya marca cambió (aparte de la del cambio que la provocó: así cada pantalla dice qué
  // pasó de verdad, "cambió el descuento por hermanos de X", y no "actualizó los datos de X").
  private async anunciarDescuento(alumnoIds: string[], tx: unknown): Promise<void> {
    if (alumnoIds.length === 0) return;
    await this.anuncios.publicar("datos.cambiaron", { dato: "alumnos", accion: "descuento", ids: { alumnoIds } }, tx);
  }

  // Bloquea las fichas (únicas, ordenadas por id) y las devuelve en ese orden.
  private async bloquearFamilias(padreIds: (string | undefined)[], tx: unknown): Promise<string[]> {
    const familias = [...new Set(padreIds.filter((p): p is string => !!p))].sort();
    for (const padreId of familias) await this.padreRepo.bloquear(padreId, tx);
    return familias;
  }

  // La inscripción es una sola operación: el responsable (si es nuevo) y el alumno se crean juntos o no se crea nada.
  async inscribirAlumno(datos: NuevoAlumnoInput): Promise<Alumno> {
    if (datos.dni && (await this.alumnoRepo.findByDni(datos.dni))) {
      throw new ConflictError(`Ya existe un alumno inscripto con el DNI ${datos.dni}`);
    }

    // Además del alta del Alumno, se deja asentada la inscripción del ciclo
    // activo (historial por año) — atómico, para no crear el alumno sin su
    // registro de inscripción si algo falla a mitad de camino.
    return this.unitOfWork.runInTransaction(async (tx) => {
      const curso = await this.cursoRepo.findById(datos.cursoId, tx);
      if (!curso) throw new EntityNotFoundError("Curso", datos.cursoId);
      await this.exigirCursoDelCicloActivo(curso, tx);

      const responsable = await this.resolverResponsable(datos.responsable, datos, null, curso.nivel, tx);
      // Con la ficha bloqueada, dos inscripciones simultáneas del mismo responsable se hacen de a una: la segunda ve a la
      // primera. Un alumno activo con el mismo nombre a su cargo es el mismo envío repetido (o la misma persona ya cargada).
      await this.padreRepo.bloquear(responsable.padre.id, tx);
      const hijos = await this.alumnoRepo.findByPadreId(responsable.padre.id, tx);
      const hermanosActivos = hijos.filter((h) => h.estado === "activo");
      const clave = normalizarNombre(responsable.nombre, responsable.apellido);
      const repetido = hermanosActivos.find((h) => normalizarNombre(h.nombre, h.apellido) === clave);
      if (repetido) throw new ConflictError(`Ese responsable ya tiene un alumno activo llamado ${repetido.nombre} ${repetido.apellido}`);
      // Descuento del 10% a partir del segundo hijo (regla única, `alumno.hermanos`): como la fecha de inscripción del
      // nuevo es la más reciente, nunca cambia la marca de sus hermanos.
      const id = randomUUID();
      const fechaInscripcion = new Date();
      const aplicaDescuentoHermanos = alumnosConDescuento([
        ...hermanosActivos,
        { id, estado: "activo", fechaInscripcion, aplicaDescuentoHermanos: false },
      ]).has(id);

      const nuevo: Alumno = {
        id,
        nombre: responsable.nombre,
        apellido: responsable.apellido,
        dni: datos.dni,
        fechaNacimiento: datos.fechaNacimiento,
        direccion: datos.direccion,
        telefono: datos.telefono,
        email: datos.email,
        foto: datos.foto,
        observacionesMedicas: datos.observacionesMedicas,
        padreId: responsable.padre.id,
        vinculoResponsable: responsable.vinculo,
        cursoId: datos.cursoId,
        fechaInscripcion,
        estado: "activo",
        aplicaDescuentoHermanos,
      };
      const creado = await this.alumnoRepo.create(nuevo, tx);
      const cicloActivo = await this.cicloRepo.findActivo(tx);
      if (cicloActivo) {
        await this.cicloRepo.crearInscripcion(
          {
            id: randomUUID(),
            alumnoId: creado.id,
            cursoId: datos.cursoId,
            cicloId: cicloActivo.id,
            fecha: creado.fechaInscripcion,
            aplicaDescuentoHermanos,
          },
          tx,
        );
      }
      // Cuota del mes de inscripción (si hay valor de cuota cargado y el mes
      // es lectivo); las de los meses siguientes las genera la tarea periódica.
      await this.cuotaService.generarCuotaInicial(creado, new Date(), tx);
      await this.anuncios.publicar("alumnos.cambiaron", { alumnoId: creado.id }, tx);
      await this.anuncios.publicar(
        "datos.cambiaron",
        { dato: "alumnos", accion: "inscripcion", ids: { alumnoIds: [creado.id], cursoIds: [datos.cursoId] } },
        tx,
      );
      return creado;
    });
  }

  // Asigna o cambia el responsable de un alumno ya inscripto (o su vínculo, o pasa a ser responsable de sí mismo).
  // Si cambia de familia, el descuento por hermanos se recalcula en las dos (la que lo deja y la que lo recibe). Al dejar
  // de ser "propio", termina la sincronización de nombre, apellido y DNI y la ficha anterior queda como estaba.
  async asignarResponsable(id: string, responsable: ResponsableInput): Promise<Alumno> {
    return this.unitOfWork.runInTransaction(async (tx) => {
      // Las fichas primero y el alumno después (el recálculo del descuento toca a los hermanos de las dos familias).
      const previo = await this.alumnoRepo.findById(id, tx);
      if (!previo) throw new EntityNotFoundError("Alumno", id);
      await this.bloquearFamilias([previo.padreId, responsable.tipo === "existente" ? responsable.padreId : undefined], tx);
      await this.alumnoRepo.bloquear(id, tx);
      const actual = await this.alumnoRepo.findById(id, tx);
      if (!actual) throw new EntityNotFoundError("Alumno", id);
      // Con las fichas bloqueadas por lo que se leyó antes: si en el medio cambió de responsable, las fichas tomadas
      // ya no son las suyas.
      if (actual.padreId !== previo.padreId) throw new ConflictError("El responsable del alumno cambió mientras tanto: volvé a intentarlo");

      const curso = actual.cursoId ? await this.cursoRepo.findById(actual.cursoId, tx) : null;
      const resuelto = await this.resolverResponsable(responsable, actual, id, curso?.nivel ?? null, tx);
      const guardado = await this.alumnoRepo.actualizarParcial(
        id,
        {
          padreId: resuelto.padre.id,
          vinculoResponsable: resuelto.vinculo,
          ...(resuelto.nombre !== actual.nombre || resuelto.apellido !== actual.apellido ? { nombre: resuelto.nombre, apellido: resuelto.apellido } : {}),
        },
        tx,
      );
      const cambioDeFamilia = actual.padreId !== resuelto.padre.id;
      const conMarcaNueva = cambioDeFamilia ? await this.recalcularDescuentos([actual.padreId, resuelto.padre.id], "cambio-responsable", id, tx) : [];
      await this.anuncios.publicar("alumnos.cambiaron", { alumnoId: id }, tx);
      // La familia anterior también se entera: su hijo dejó de figurar con ella.
      const familiaAnterior = actual.padreId && cambioDeFamilia ? [actual.padreId] : [];
      await this.anuncios.publicar(
        "datos.cambiaron",
        {
          dato: "alumnos",
          accion: "edicion",
          ids: { alumnoIds: [id], cursoIds: actual.cursoId ? [actual.cursoId] : [], padreIds: familiaAnterior },
        },
        tx,
      );
      await this.anunciarDescuento(conMarcaNueva, tx);
      return guardado;
    });
  }

  async actualizarAlumno(id: string, datos: ActualizarAlumnoInput): Promise<Alumno> {
    return this.unitOfWork.runInTransaction(async (tx) => {
      // Bloqueos siempre en el mismo orden (primero el alumno, después su ficha de responsable): así dos cambios
      // simultáneos que tocan las dos filas no se traban entre sí. Un cambio de estado recalcula el descuento de los
      // hermanos y por eso toma la ficha primero (ver `recalcularDescuentos`).
      const previo = await this.alumnoRepo.findById(id, tx);
      if (!previo) throw new EntityNotFoundError("Alumno", id);
      if (datos.estado !== undefined && datos.estado !== previo.estado) await this.bloquearFamilias([previo.padreId], tx);
      await this.alumnoRepo.bloquear(id, tx);
      const actual = await this.alumnoRepo.findById(id, tx);
      if (!actual) {
        throw new EntityNotFoundError("Alumno", id);
      }
      const cambiaEstado = datos.estado !== undefined && datos.estado !== actual.estado;
      // La ficha se tomó (o no) según lo leído antes del bloqueo: si en el medio cambió el estado o el responsable,
      // el orden de bloqueos ya no es el correcto.
      if (datos.estado !== undefined && (actual.estado !== previo.estado || (cambiaEstado && actual.padreId !== previo.padreId))) {
        throw new ConflictError("El alumno cambió mientras tanto: volvé a intentarlo");
      }
      // Si es responsable de sí mismo, nombre, apellido y DNI son los mismos que los de su ficha.
      const sincroniza =
        actual.vinculoResponsable === "propio" &&
        actual.padreId !== undefined &&
        (datos.nombre !== undefined || datos.apellido !== undefined || datos.dni !== undefined);
      if (sincroniza) await this.padreRepo.bloquear(actual.padreId as string, tx);

      if (datos.cursoId && datos.cursoId !== actual.cursoId) {
        const cursoNuevo = await this.cursoRepo.findById(datos.cursoId, tx);
        if (!cursoNuevo) throw new EntityNotFoundError("Curso", datos.cursoId);
        await this.exigirCursoDelCicloActivo(cursoNuevo, tx);
      }
      if (datos.dni && datos.dni !== actual.dni) {
        const otro = await this.alumnoRepo.findByDni(datos.dni, tx);
        if (otro && otro.id !== id) throw new ConflictError(`Ya existe un alumno con el DNI ${datos.dni}`);
        if (sincroniza) {
          const ficha = await this.padreRepo.findByDni(datos.dni, tx);
          if (ficha && ficha.id !== actual.padreId) throw new ConflictError(`Ya existe un responsable con el DNI ${datos.dni}`);
        }
      }
      // Solo las columnas que vinieron en el pedido: ausente no se toca, null borra.
      const resultado = await this.alumnoRepo.actualizarParcial(id, soloPresentes(datos), tx);
      if (sincroniza) {
        await this.padreRepo.actualizarParcial(
          actual.padreId as string,
          soloPresentes({ nombre: datos.nombre, apellido: datos.apellido, dni: datos.dni }),
          tx,
        );
        await this.anuncios.publicar("datos.cambiaron", { dato: "padres", accion: "edicion", ids: { padreIds: [actual.padreId as string] } }, tx);
      }

      // Si cambió de curso, la inscripción del ciclo activo tiene que
      // reflejar el nuevo curso — si no existía todavía (ej. no tenía curso
      // asignado al inscribirse), se crea recién ahora.
      if (datos.cursoId && datos.cursoId !== actual.cursoId) {
        const cicloActivo = await this.cicloRepo.findActivo(tx);
        if (cicloActivo) {
          const inscripcionExistente = await this.cicloRepo.findInscripcionByAlumnoYCiclo(id, cicloActivo.id, tx);
          if (inscripcionExistente) {
            await this.cicloRepo.actualizarInscripcion(id, cicloActivo.id, { cursoId: datos.cursoId }, tx);
          } else {
            await this.cicloRepo.crearInscripcion(
              {
                id: randomUUID(),
                alumnoId: id,
                cursoId: datos.cursoId,
                cicloId: cicloActivo.id,
                fecha: new Date(),
                aplicaDescuentoHermanos: resultado.aplicaDescuentoHermanos,
              },
              tx,
            );
          }
        }
      }

      const conMarcaNueva = cambiaEstado
        ? await this.recalcularDescuentos([resultado.padreId], resultado.estado === "activo" ? "reactivacion" : "baja", id, tx)
        : [];

      await this.anuncios.publicar("alumnos.cambiaron", { alumnoId: id }, tx);
      // Los dos cursos (el de antes y el de ahora): al profesor del curso anterior también le cambia la nómina.
      const cursoIds = [...new Set([actual.cursoId, resultado.cursoId].filter((c): c is string => !!c))];
      const accion =
        cambiaEstado
          ? datos.estado === "activo"
            ? "reactivacion"
            : "baja"
          : datos.cursoId && datos.cursoId !== actual.cursoId
            ? "cambio-curso"
            : "edicion";
      await this.anuncios.publicar("datos.cambiaron", { dato: "alumnos", accion, ids: { alumnoIds: [id], cursoIds } }, tx);
      await this.anunciarDescuento(conMarcaNueva, tx);
      return resultado;
    });
  }
}
