import type { SenalCambio } from "./types";

// Lo que el navegador ya tiene en pantalla (caché de consultas) para nombrar al alumno y el mes de una cuota.
export interface Nombres {
  alumno(id: string): string | null;
  mesDeCuota(id: string): string | null;
}

// El mensaje "quién hizo qué" de un cambio hecho por otra persona. Quién es la primera palabra de su nombre; los
// cambios del sistema (la tarea de las 03:00) se dicen en forma impersonal cuando la hay, o "El sistema …". Sin el
// nombre del alumno en caché, el texto va sin él. Las sesiones no llevan mensaje (null).
export function textoDelCambio(c: SenalCambio, nombres: Nombres): string | null {
  const quien = c.por ? c.por.nombre.trim().split(/\s+/)[0] : "El sistema";
  const alumnos = c.ids.alumnoIds ?? [];
  const cuotas = c.ids.cuotaIds ?? [];
  // El alumno, si el cambio es de uno solo y está en caché.
  const alumno = alumnos.length === 1 ? nombres.alumno(alumnos[0]) : null;
  const sobre = (frase: string, sinNombre: string) => (alumno ? `${quien} ${frase} ${alumno}` : `${quien} ${sinNombre}`);

  switch (`${c.dato}/${c.accion}`) {
    case "cuotas/cobro": {
      if (cuotas.length > 1) return `${quien} cobró ${cuotas.length} cuotas`;
      const mes = cuotas.length === 1 ? nombres.mesDeCuota(cuotas[0]) : null;
      return mes && alumno ? `${quien} cobró la cuota de ${mes} de ${alumno}` : `${quien} cobró una cuota`;
    }
    case "cuotas/vencimiento":
      return cuotas.length === 1 ? "Se marcó vencida una cuota" : `Se marcaron vencidas ${cuotas.length} cuotas`;
    case "cuotas/generacion":
      return cuotas.length === 1 ? "Se generó una cuota" : `Se generaron ${cuotas.length} cuotas`;
    case "alumnos/inscripcion":
      return alumnos.length > 1 ? `${quien} inscribió a ${alumnos.length} alumnos` : sobre("inscribió a", "inscribió a un alumno");
    case "alumnos/cambio-curso":
      return sobre("cambió de curso a", "cambió de curso a un alumno");
    case "alumnos/baja":
      return sobre("dio de baja a", "dio de baja a un alumno");
    case "alumnos/reactivacion":
      return sobre("reactivó a", "reactivó a un alumno");
    case "alumnos/edicion":
      return sobre("actualizó los datos de", "actualizó los datos de un alumno");
    case "cursos/alta":
      return `${quien} creó un curso`;
    case "cursos/edicion":
      return `${quien} modificó un curso`;
    case "evaluaciones/alta":
      return `${quien} creó una evaluación`;
    case "evaluaciones/publicacion":
      return `${quien} publicó una evaluación`;
    case "calificaciones/carga":
      return `${quien} cargó notas`;
    case "notas-cierre/carga":
      return `${quien} cargó notas de cierre`;
    case "notas-cierre/publicacion":
      return alumnos.length === 1 && alumno ? `${quien} publicó la nota de cierre de ${alumno}` : `${quien} publicó las notas de cierre de ${alumnos.length} alumnos`;
    case "asistencia/registro":
      return `${quien} tomó asistencia`;
    case "observaciones/alta":
      return sobre("escribió una observación sobre", "escribió una observación");
    case "categorias/alta":
      return `${quien} creó una categoría de observaciones`;
    case "documentos/carga":
      return sobre("cargó un documento de", "cargó un documento");
    case "documentos/autorizacion":
      return sobre("autorizó el uso de imagen de", "autorizó el uso de imagen de un alumno");
    case "documentos/revocacion":
      return sobre("revocó la autorización de imagen de", "revocó una autorización de imagen");
    case "documentos/manual":
      return sobre("registró la autorización de imagen de", "registró una autorización de imagen");
    case "padres/alta":
      return `${quien} dio de alta a un padre o madre`;
    case "padres/edicion":
      return `${quien} actualizó los datos de un padre o madre`;
    case "profesores/alta":
      return `${quien} dio de alta a un docente`;
    case "profesores/edicion":
      return `${quien} actualizó los datos de un docente`;
    case "usuarios/alta":
      return `${quien} creó una cuenta`;
    case "usuarios/estado":
      return `${quien} cambió el estado de una cuenta`;
    case "usuarios/invitacion":
      return `${quien} actualizó las invitaciones`;
    case "configuracion/edicion":
      return `${quien} cambió la configuración`;
    case "ciclos/alta":
      return `${quien} creó un ciclo lectivo`;
    case "ciclos/activacion":
      return `${quien} cambió el ciclo lectivo activo`;
    default:
      return null;
  }
}
