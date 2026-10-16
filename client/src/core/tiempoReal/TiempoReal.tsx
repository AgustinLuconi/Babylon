import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { irAlLogin } from "@/core/lib/apiClient";
import { sidDelToken } from "@/core/lib/token";
import { useSessionStore } from "@/core/store/sessionStore";
import { avisarCierreLocal, iniciarTiempoReal } from "./coordinador";
import type { SenalEnVivo } from "./lectorSse";

const MOTIVOS_CON_MENSAJE = ["cerrada-por-el-usuario", "cerrada-desde-otro-dispositivo", "contrasena-cambiada", "cuenta-desactivada"];

// "vencida" (o un motivo desconocido) se muestra como la sesión vencida de siempre.
function motivoParaElLogin(datos: unknown): string {
  const motivo = (datos as { motivo?: unknown } | null)?.motivo;
  return typeof motivo === "string" && MOTIVOS_CON_MENSAJE.includes(motivo) ? motivo : "sesion-vencida";
}

// Mantiene la conexión en vivo mientras haya sesión (va dentro de AppLayout): actualiza la campana cuando llega una
// señal o al (re)conectarse, y lleva al login si la sesión se cerró desde otro lado.
export function TiempoReal() {
  const token = useSessionStore((s) => s.token);
  const queryClient = useQueryClient();

  useEffect(() => {
    const sid = token ? sidDelToken(token) : null;
    if (!token || !sid) return;
    const alSenal = (senal: SenalEnVivo) => {
      if (senal.tipo === "notificaciones" || senal.tipo === "listo") {
        void queryClient.invalidateQueries({ queryKey: ["notificaciones"] });
      } else if (senal.tipo === "sesion-cerrada") {
        irAlLogin(motivoParaElLogin(senal.datos));
      } else if (senal.tipo === "rechazo") {
        irAlLogin("sesion-vencida");
      }
    };
    const detener = iniciarTiempoReal(sid, token, alSenal);
    return () => {
      detener();
      // Si se cerró la sesión desde esta pestaña (ya no hay token), las demás pestañas de la misma sesión también salen.
      if (!useSessionStore.getState().token) avisarCierreLocal(sid);
    };
  }, [token, queryClient]);

  return null;
}
