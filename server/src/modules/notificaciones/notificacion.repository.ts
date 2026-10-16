import type { Repository } from "../../core/ports";
import type { Destinatario, Notificacion, TipoNotificacion } from "./notificacion.entity";

export type FiltroHistorial = "todas" | "no-leidas" | "pendientes";

export interface OpcionesHistorial {
  desde: Date;
  filtro: FiltroHistorial;
  despuesDe?: string;
  limite: number;
}

export interface NotificacionRepository extends Repository<Notificacion> {
  // Bloquea esos tipos hasta el final de la transacción (en orden, para que dos transacciones no se traben).
  bloquearTipos(tipos: TipoNotificacion[], tx: unknown): Promise<void>;
  findPorTipo(tipo: TipoNotificacion, tx?: unknown): Promise<Notificacion[]>;
  crearVarias(avisos: Notificacion[], tx?: unknown): Promise<void>;
  actualizarParcial(id: string, datos: Partial<Notificacion>, tx?: unknown): Promise<void>;
  // Crea las que no existen (misma cuenta, rol y clave) y devuelve a quiénes se les creó algo.
  crearEventos(avisos: Notificacion[], tx?: unknown): Promise<Destinatario[]>;
  findDesactivadas(tipo: TipoNotificacion, tx?: unknown): Promise<Destinatario[]>;
  findDesactivadasDe(d: Destinatario, tx?: unknown): Promise<TipoNotificacion[]>;
  // Apaga el tipo para esa cuenta y rol y borra sus avisos de ese tipo (también del historial).
  desactivar(d: Destinatario, tipo: TipoNotificacion, tx?: unknown): Promise<void>;
  activar(d: Destinatario, tipo: TipoNotificacion, tx?: unknown): Promise<void>;
  // Abiertos (de estado sin resolver, leídos o no) y eventos sin leer: primero los no leídos, después el más reciente.
  campana(d: Destinatario, limite: number): Promise<Notificacion[]>;
  contarNoLeidas(d: Destinatario): Promise<number>;
  historial(d: Destinatario, opciones: OpcionesHistorial): Promise<Notificacion[]>;
  // false si el aviso no existe o es de otra cuenta u otro rol.
  marcarLeida(id: string, d: Destinatario, ahora: Date): Promise<boolean>;
  marcarTodasLeidas(d: Destinatario, ahora: Date): Promise<number>;
  // Borra los avisos actualizados antes de `antesDe`, salvo los de estado abiertos.
  limpiar(antesDe: Date): Promise<number>;
}
