import type { Rol } from "../../core/ports";

// Qué dato cambió. Cada pantalla del navegador sabe qué datos muestra y, con esto, vuelve a pedir solo lo afectado.
export type TipoDato =
  | "cuotas"
  | "alumnos"
  | "cursos"
  | "evaluaciones"
  | "calificaciones"
  | "notas-cierre"
  | "asistencia"
  | "observaciones"
  | "categorias"
  | "documentos"
  | "padres"
  | "profesores"
  | "usuarios"
  | "configuracion"
  | "ciclos"
  | "sesiones";

export type AccionCambio =
  | "cobro"
  | "vencimiento"
  | "generacion"
  | "inscripcion"
  | "edicion"
  | "cambio-curso"
  | "baja"
  | "reactivacion"
  | "alta"
  | "publicacion"
  | "carga"
  | "registro"
  | "autorizacion"
  | "revocacion"
  | "manual"
  | "estado"
  | "invitacion"
  | "activacion"
  | "inicio"
  | "cierre";

// Solo identificadores: nunca nombres ni datos de alumnos o familias.
export type IdsDeCambio = Partial<
  Record<
    "alumnoIds" | "cursoIds" | "cuotaIds" | "evaluacionIds" | "observacionIds" | "padreIds" | "profesorIds" | "usuarioIds" | "cicloIds",
    string[]
  >
>;

export interface CambioDeDatos {
  dato: TipoDato;
  accion: AccionCambio;
  ids: IdsDeCambio;
  // Notas cargadas en una evaluación: las familias solo se enteran si ya está publicada.
  visibleParaFamilias?: boolean;
}

// Quién hizo el cambio (null = el sistema, por ejemplo la tarea de las 03:00).
export interface PorQuien {
  usuarioId: string;
  nombre: string;
  rol: Rol;
}

// Lo que viaja por la conexión en vivo.
export interface SenalCambio extends Omit<CambioDeDatos, "visibleParaFamilias"> {
  por: PorQuien | null;
}

// Administración y secretaría (por rol) reciben los ids completos; cada cuenta de familia o de profesor recibe los suyos,
// recortados a lo que le corresponde (nunca ids de otras familias ni de cursos ajenos).
export interface Destinatarios {
  roles: Rol[];
  cuentas: { usuarioId: string; rol: Rol; ids: IdsDeCambio }[];
}
