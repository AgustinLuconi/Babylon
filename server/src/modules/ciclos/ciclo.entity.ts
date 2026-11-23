export interface Ciclo {
  id: string;
  anio: number;
  activo: boolean;
  bloqueado: boolean;
  // Días de clases del ciclo (medianoche UTC). Los dos null = calendario por defecto (1/3 al 30/11 del año del ciclo).
  inicio: Date | null;
  fin: Date | null;
}

export type TipoDePausa = "receso" | "feriado" | "otro";

// Días sin clases dentro de un ciclo. Un feriado es una pausa de un solo día (desde = hasta).
export interface PausaDelCiclo {
  id: string;
  cicloId: string;
  desde: Date;
  hasta: Date;
  nombre: string;
  tipo: TipoDePausa;
}

// Lo que devuelve el listado de ciclos: las fechas ya resueltas (nunca null) y sus pausas.
export interface CicloConCalendario extends Omit<Ciclo, "inicio" | "fin"> {
  inicio: Date;
  fin: Date;
  pausas: PausaDelCiclo[];
}
