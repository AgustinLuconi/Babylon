import type { Rol } from "@/features/auth/types";
import type { RecursoAviso } from "./types";

const conFiltros = (ruta: string, filtros: Record<string, string>) => `${ruta}?${new URLSearchParams(filtros)}`;

// Del recurso de un aviso a la pantalla donde se resuelve, según el rol. El aviso no guarda direcciones: si una
// pantalla cambia de ruta, se cambia acá y los avisos viejos siguen funcionando.
export function rutaDeAviso(recurso: RecursoAviso, rol: Rol): string {
  switch (recurso.tipo) {
    case "cuotas-vencidas":
      return conFiltros("/cuotas", { pestana: "vencidas" });
    case "documentacion-pendiente":
      return conFiltros("/alumnos", { ciclo: "activo", documentacion: "pendiente" });
    case "evaluacion":
      // Administración y secretaría ven las próximas evaluaciones en su panel.
      return rol === "profesor" ? conFiltros("/calificaciones", { curso: recurso.cursoId, evaluacion: recurso.evaluacionId }) : "/dashboard";
    case "asistencia":
      return conFiltros("/asistencia", { curso: recurso.cursoId, fecha: recurso.fecha });
    case "cierre":
      return conFiltros("/calificaciones", { curso: recurso.cursoId, vista: "cierre", periodo: recurso.periodo });
    case "cuota":
      return conFiltros("/mis-hijos/cuotas", { hijo: recurso.alumnoId });
    case "documentacion":
      return conFiltros("/mis-hijos/documentacion", { hijo: recurso.alumnoId });
    case "calificaciones":
      return conFiltros("/mis-hijos/calificaciones", { hijo: recurso.alumnoId });
    case "hijo":
      return conFiltros("/mis-hijos", { hijo: recurso.alumnoId });
    case "chat":
      return rol === "padre" ? "/chat" : conFiltros("/chats", { conversacion: recurso.chatId });
  }
}
