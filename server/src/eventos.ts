import type { EventosAlumnos } from "./modules/alumnos/alumno.eventos";
import type { EventosAsistencia } from "./modules/asistencia/asistencia.eventos";
import type { EventosCalificaciones } from "./modules/calificaciones/calificacion.eventos";
import type { EventosChats } from "./modules/chats/chat.eventos";
import type { EventosCiclos } from "./modules/ciclos/ciclo.eventos";
import type { EventosCuotas } from "./modules/cuotas/cuota.eventos";
import type { EventosCursos } from "./modules/cursos/curso.eventos";
import type { EventosDocumentos } from "./modules/documentos/documento.eventos";
import type { EventosObservaciones } from "./modules/observaciones/observacion.eventos";
import type { EventosUsuarios } from "./modules/usuarios/usuario.eventos";

// Catálogo de todos los anuncios del sistema (solo tipos, al lado de container.ts, que arma el tablero con este mapa).
export type EventosDelSistema = EventosAlumnos &
  EventosAsistencia &
  EventosCalificaciones &
  EventosChats &
  EventosCiclos &
  EventosCuotas &
  EventosCursos &
  EventosDocumentos &
  EventosObservaciones &
  EventosUsuarios;
