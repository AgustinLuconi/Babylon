import type { Rol } from "@/features/auth/types";

// Igual que en el server (modules/cambios/cambio.entity.ts): qué dato cambió, qué acción fue, los ids afectados y
// quién lo hizo (null = el sistema). Nunca trae nombres de alumnos: los arma el navegador con lo que ya tiene.
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

export type IdsDeCambio = Partial<
  Record<
    "alumnoIds" | "cursoIds" | "cuotaIds" | "evaluacionIds" | "observacionIds" | "padreIds" | "profesorIds" | "usuarioIds" | "cicloIds",
    string[]
  >
>;

export interface PorQuien {
  usuarioId: string;
  nombre: string;
  rol: Rol;
}

export interface SenalCambio {
  dato: TipoDato;
  accion: AccionCambio;
  ids: IdsDeCambio;
  por: PorQuien | null;
}
