import type { AvisoEsperado, TipoEstado } from "./notificacion.entity";

// De dónde sale cada aviso: qué avisos de estado tienen que estar abiertos ahora (en todo el instituto) y qué avisos
// crea cada evento. Es el único lugar con el criterio de cada tipo: los anuncios de los módulos solo piden "sincronizá
// este tipo", y la revisión nocturna llama a lo mismo.
export interface CriteriosDeAvisos {
  esperados(tipo: TipoEstado, ahora: Date, tx?: unknown): Promise<AvisoEsperado[]>;
  notasPublicadas(evaluacionId: string, alumnoIds: string[] | null, tx?: unknown): Promise<AvisoEsperado[]>;
  cierrePublicado(notaCierreId: string, tx?: unknown): Promise<AvisoEsperado[]>;
  observacionNueva(observacionId: string, tx?: unknown): Promise<AvisoEsperado[]>;
}
