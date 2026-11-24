import { randomUUID } from "node:crypto";
import { AuthorizationError, ConflictError, EntityNotFoundError } from "../../core/errors";
import type { Publicador, Rol, UnitOfWork } from "../../core/ports";
import { sinAnuncios } from "../../core/eventos";
import { cicloSiempreAbierto, type VerificadorDeCiclo } from "../ciclos/ciclo.guarda";
import type { CursoRepository } from "../cursos/curso.repository";
import type { AlumnoRepository } from "../alumnos/alumno.repository";
import type { AsistenciaRepository } from "./asistencia.repository";
import type { Asistencia, ClaseSinDictar } from "./asistencia.entity";
import type { MarcarSinClasesInput, QuitarSinClasesInput, RegistrarAsistenciaMasivaInput } from "./asistencia.schema";
import type { EventosCambios } from "../cambios/cambio.eventos";
import type { EventosAsistencia } from "./asistencia.eventos";

export interface Solicitante {
  rol: Rol;
  padreId?: string;
}

export class AsistenciaService {
  constructor(
    private readonly asistenciaRepo: AsistenciaRepository,
    private readonly cursoRepo: CursoRepository,
    private readonly alumnoRepo: AlumnoRepository,
    private readonly unitOfWork: UnitOfWork,
    private readonly anuncios: Publicador<EventosAsistencia & EventosCambios> = sinAnuncios(),
    private readonly verificador: VerificadorDeCiclo = cicloSiempreAbierto(),
  ) {}

  private async verificarDuenoDelCurso(cursoId: string, profesorId: string): Promise<void> {
    const curso = await this.cursoRepo.findById(cursoId);
    if (!curso) {
      throw new EntityNotFoundError("Curso", cursoId);
    }
    if (curso.profesorId !== profesorId) {
      throw new AuthorizationError("Un profesor solo puede registrar asistencia en sus propios cursos");
    }
  }

  // Toma (o corrige) la asistencia de toda la nómina de un curso en una sola
  // operación atómica: si un alumno ya tenía asistencia cargada esa fecha, se
  // actualiza en vez de duplicarse — permite navegar a una clase anterior y
  // corregirla, igual que el prototipo ("cargarla o corregirla").
  async registrarAsistenciaMasiva(datos: RegistrarAsistenciaMasivaInput, profesorId: string): Promise<Asistencia[]> {
    await this.verificarDuenoDelCurso(datos.cursoId, profesorId);

    return this.unitOfWork.runInTransaction(async (tx) => {
      await this.verificador.verificarCicloDelCurso(datos.cursoId, tx);
      // Guardar asistencia y marcar la clase como "sin clases" toman el mismo bloqueo (curso y día): no pueden cruzarse. Una
      // clase marcada no admite asistencia hasta que se quita la marca.
      await this.asistenciaRepo.bloquearClase(datos.cursoId, datos.fecha, tx);
      if (await this.asistenciaRepo.findClaseSinDictar(datos.cursoId, datos.fecha, tx)) {
        throw new ConflictError("Esa clase está marcada como sin clases: quitá la marca para tomar asistencia");
      }
      // Solo se carga asistencia NUEVA un día con clases del calendario del ciclo del curso (no en feriados, pausas ni fuera
      // del ciclo). Corregir o justificar lo ya guardado siempre se puede: si el día pasó a no tener clases después de tomar
      // la asistencia, no puede quedar congelada. Se verifica una sola vez, antes de crear el primer registro nuevo.
      let diaVerificado = false;
      const asistencias: Asistencia[] = [];

      for (const registro of datos.registros) {
        const existente = await this.asistenciaRepo.findByAlumnoCursoFecha(
          registro.alumnoId,
          datos.cursoId,
          datos.fecha,
          tx,
        );

        if (existente) {
          const actualizada: Asistencia = {
            ...existente,
            estado: registro.estado,
            minutosRetraso: registro.minutosRetraso,
            motivo: registro.motivo,
            justificada: registro.estado === "ausente" && registro.justificada === true,
          };
          await this.asistenciaRepo.update(existente.id, actualizada, tx);
          asistencias.push(actualizada);
          continue;
        }

        if (!diaVerificado) {
          await this.verificador.verificarDiaDeClases(datos.cursoId, datos.fecha.toISOString().slice(0, 10), tx);
          diaVerificado = true;
        }
        const asistencia: Asistencia = {
          id: randomUUID(),
          alumnoId: registro.alumnoId,
          cursoId: datos.cursoId,
          fecha: datos.fecha,
          estado: registro.estado,
          minutosRetraso: registro.minutosRetraso,
          motivo: registro.motivo,
          justificada: registro.estado === "ausente" && registro.justificada === true,
        };
        await this.asistenciaRepo.create(asistencia, tx);
        asistencias.push(asistencia);
      }

      await this.anuncios.publicar("asistencia.registrada", { cursoId: datos.cursoId }, tx);
      await this.anuncios.publicar(
        "datos.cambiaron",
        { dato: "asistencia", accion: "registro", ids: { cursoIds: [datos.cursoId], alumnoIds: datos.registros.map((r) => r.alumnoId) } },
        tx,
      );
      return asistencias;
    });
  }

  // Marca una clase del curso como "sin clases" (un imprevisto): no cuenta como falta ni como asistencia y ese día no admite
  // asistencia. Solo el profesor del curso, un día con clases del calendario y sin asistencia ya guardada. Repetirlo solo
  // actualiza el motivo.
  async marcarSinClases(datos: MarcarSinClasesInput, profesorId: string, registradaPor: string): Promise<ClaseSinDictar> {
    await this.verificarDuenoDelCurso(datos.cursoId, profesorId);
    return this.unitOfWork.runInTransaction(async (tx) => {
      await this.verificador.verificarCicloDelCurso(datos.cursoId, tx);
      await this.asistenciaRepo.bloquearClase(datos.cursoId, datos.fecha, tx);
      const existente = await this.asistenciaRepo.findClaseSinDictar(datos.cursoId, datos.fecha, tx);
      // Una marca que ya existe solo cambia de motivo: eso se puede aunque el calendario cambiara después (el día pasó a ser pausa).
      if (!existente) {
        await this.verificador.verificarDiaDeClases(datos.cursoId, datos.fecha.toISOString().slice(0, 10), tx);
        if ((await this.asistenciaRepo.contarRegistrosDelDia(datos.cursoId, datos.fecha, tx)) > 0) {
          throw new ConflictError("Ese día ya tiene asistencia guardada: no se puede marcar como sin clases");
        }
      }
      const clase = existente
        ? await this.asistenciaRepo.actualizarMotivoDeClaseSinDictar(existente.id, datos.motivo ?? null, tx)
        : await this.asistenciaRepo.crearClaseSinDictar(
            { id: randomUUID(), cursoId: datos.cursoId, fecha: datos.fecha, motivo: datos.motivo, registradaPor, creadaEn: new Date() },
            tx,
          );
      await this.anunciarCambioDeClase(datos.cursoId, "sin-clases", tx);
      return clase;
    });
  }

  // Quita la marca de "sin clases": la clase vuelve a admitir asistencia. Si no estaba marcada, no hace nada.
  async quitarSinClases(datos: QuitarSinClasesInput, profesorId: string): Promise<void> {
    await this.verificarDuenoDelCurso(datos.cursoId, profesorId);
    await this.unitOfWork.runInTransaction(async (tx) => {
      await this.verificador.verificarCicloDelCurso(datos.cursoId, tx);
      await this.asistenciaRepo.bloquearClase(datos.cursoId, datos.fecha, tx);
      const existente = await this.asistenciaRepo.findClaseSinDictar(datos.cursoId, datos.fecha, tx);
      if (!existente) return;
      await this.asistenciaRepo.eliminarClaseSinDictar(existente.id, tx);
      await this.anunciarCambioDeClase(datos.cursoId, "quitar-sin-clases", tx);
    });
  }

  // Los avisos se revisan (asistencia pendiente) y las pantallas de los alumnos del curso —y sus familias— se ponen al día.
  private async anunciarCambioDeClase(cursoId: string, accion: "sin-clases" | "quitar-sin-clases", tx: unknown): Promise<void> {
    const alumnoIds = (await this.alumnoRepo.findByCursoId(cursoId, tx)).map((a) => a.id);
    await this.anuncios.publicar("asistencia.registrada", { cursoId }, tx);
    await this.anuncios.publicar("datos.cambiaron", { dato: "asistencia", accion, ids: { cursoIds: [cursoId], alumnoIds } }, tx);
  }

  // Las clases sin dictar de un curso, con el motivo (solo para el equipo): administración, secretaría y el profesor del curso.
  async listarSinClasesDeCurso(cursoId: string, solicitante: { rol: Rol; profesorId?: string }): Promise<{ fecha: Date; motivo?: string }[]> {
    if (solicitante.rol === "profesor") await this.verificarDuenoDelCurso(cursoId, solicitante.profesorId ?? "");
    const clases = await this.asistenciaRepo.findSinDictarByCursoId(cursoId);
    return clases.map((c) => ({ fecha: c.fecha, motivo: c.motivo }));
  }

  // Las clases sin dictar de los cursos de un alumno (desde que se inscribió en cada curso). **El motivo es solo de administración y
  // secretaría** (se quita acá, no en la pantalla; el profesor lo lee en su curso) y la familia solo ve a su propio hijo.
  async listarSinClasesDeAlumno(alumnoId: string, solicitante: Solicitante): Promise<{ cursoId: string; fecha: Date; motivo?: string }[]> {
    if (solicitante.rol === "padre") {
      const alumno = await this.alumnoRepo.findById(alumnoId);
      if (!alumno || alumno.padreId !== solicitante.padreId) {
        throw new AuthorizationError("Un padre solo puede ver los datos de sus propios hijos");
      }
    }
    const clases = await this.asistenciaRepo.findSinDictarByAlumnoId(alumnoId);
    const conMotivo = solicitante.rol === "admin" || solicitante.rol === "secretario";
    return clases.map((c) => (conMotivo ? { cursoId: c.cursoId, fecha: c.fecha, motivo: c.motivo } : { cursoId: c.cursoId, fecha: c.fecha }));
  }

  async listarPorAlumno(alumnoId: string, solicitante: Solicitante): Promise<Asistencia[]> {
    if (solicitante.rol === "padre") {
      const alumno = await this.alumnoRepo.findById(alumnoId);
      if (!alumno || alumno.padreId !== solicitante.padreId) {
        throw new AuthorizationError("Un padre solo puede ver los datos de sus propios hijos");
      }
    }
    return this.asistenciaRepo.findByAlumnoId(alumnoId);
  }
}
