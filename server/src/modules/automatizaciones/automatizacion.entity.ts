import type { AlertaEsperada, MotivoCierre, ReglaId } from "./automatizacion.reconciliar";

export type { AlertaEsperada, MotivoCierre, ReglaId };

export const REGLA_IDS: ReglaId[] = ["deuda_cuotas", "inasistencias_seguidas"];

// Una regla vive en el código: su nombre, su descripción y el rango del número que el administrador puede elegir.
export interface DefinicionDeRegla {
  id: ReglaId;
  nombre: string;
  descripcion: string;
  umbralPorDefecto: number;
  umbralMinimo: number;
  umbralMaximo: number;
  unidad: string;
}

export const REGLAS: Record<ReglaId, DefinicionDeRegla> = {
  deuda_cuotas: {
    id: "deuda_cuotas",
    nombre: "Alumno con deuda",
    descripcion: "Avisa cuando un alumno activo tiene tantas cuotas vencidas o más como el número elegido.",
    umbralPorDefecto: 2,
    umbralMinimo: 1,
    umbralMaximo: 12,
    unidad: "cuotas vencidas",
  },
  inasistencias_seguidas: {
    id: "inasistencias_seguidas",
    nombre: "Inasistencias seguidas",
    descripcion: "Avisa cuando un alumno activo falta, sin justificar, tantas clases seguidas o más como el número elegido.",
    umbralPorDefecto: 3,
    umbralMinimo: 2,
    umbralMaximo: 10,
    unidad: "inasistencias seguidas",
  },
};

// Configuración guardada de una regla (lo que el administrador cambia).
export interface ConfigDeRegla {
  regla: ReglaId;
  activa: boolean;
  umbral: number;
  ultimaRevisionEn: Date | null;
}

export interface AlertaAutomatica {
  id: string;
  regla: ReglaId;
  alumnoId: string;
  cursoId: string | null;
  nivel: number;
  abiertaEn: Date;
  resueltaEn: Date | null;
  motivoCierre: MotivoCierre | null;
}

// Lo que cada regla calcula contra la base: qué alumnos están en alerta ahora y a quiénes alcanza la regla (la población: sirve
// para distinguir "se resolvió" de "ya no corresponde").
export interface EvaluacionDeRegla {
  esperadas: AlertaEsperada[];
  poblacion: Set<string>;
}
export interface EvaluadorDeRegla {
  evaluar(umbral: number, tx?: unknown): Promise<EvaluacionDeRegla>;
}
export type EvaluadoresDeReglas = Record<ReglaId, EvaluadorDeRegla>;
