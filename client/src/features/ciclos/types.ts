export type TipoDePausa = "receso" | "feriado" | "otro";

// Días sin clases de un ciclo (receso de invierno, feriados). Un feriado es una pausa de un solo día.
export interface PausaDelCiclo {
  id: string;
  cicloId: string;
  desde: string;
  hasta: string;
  nombre: string;
  tipo: TipoDePausa;
}

export interface Ciclo {
  id: string;
  anio: number;
  activo: boolean;
  // Un ciclo bloqueado no admite cambios de lo que le pertenece (cursos, asistencia, notas…).
  bloqueado: boolean;
  // Días de clases del ciclo (sin fechas cargadas, el servidor devuelve el calendario por defecto: 1/3 al 30/11).
  inicio: string;
  fin: string;
  pausas: PausaDelCiclo[];
}

export interface EditarFechasInput {
  inicio: string;
  fin: string;
}

export interface PausaInput {
  desde: string;
  hasta: string;
  nombre: string;
  tipo: TipoDePausa;
}

export interface CrearCicloInput {
  anio: number;
}

// ── Asistente "Pasar de año" (mismos nombres que en el server: no comparten código) ──
export type DestinoDeAlumnos =
  | { tipo: "curso"; cursoId: string }
  | { tipo: "copia"; copiaDe: string }
  | { tipo: "egresan" }
  | { tipo: "no-continuan" };

export interface PaseDeAnioInput {
  origenId: string;
  destino: { cicloId: string } | { anio: number };
  copiarCursoIds: string[];
  cursos: {
    cursoOrigenId: string;
    destino?: DestinoDeAlumnos;
    excepciones?: { alumnoId: string; destino: DestinoDeAlumnos }[];
  }[];
  cierre?: { activarDestino: boolean; bloquearOrigen: boolean };
}

export interface CursoOrigen {
  id: string;
  nombre: string;
  alumnos: { id: string; nombre: string; cursoActualId: string | null }[];
}

export interface VistaPreviaPaseDeAnio {
  copias: { cursoOrigenId: string; reutilizaCursoId: string | null }[];
  movimientos: { alumnoId: string; destino: DestinoDeAlumnos }[];
  yaInscriptos: { alumnoId: string; cursoNombre: string }[];
  avisos: { alumnoId: string; tipo: "curso-actual-distinto" }[];
  cursosSinDecision: string[];
  invalidos: string[];
  origenAnio: number;
  destinoAnio: number;
  destinoNuevo: boolean;
  origen: CursoOrigen[];
  cursosDestino: { id: string; nombre: string }[];
  totales: { pasan: number; egresan: number; noContinuan: number; cursosCopiados: number };
  advertenciaAnioEnCurso: boolean;
}

export interface ResumenPaseDeAnio {
  pasan: number;
  egresan: number;
  noContinuan: number;
  cursosCreados: number;
  cursosReutilizados: number;
  yaInscriptos: number;
  destinoCicloId: string;
}
