import { AlertCircle, Clock, Info } from "lucide-react";
import type { TonoNotificacion } from "./types";

export const ICONO_TONO = { danger: AlertCircle, warning: Clock, info: Info } as const;
export const COLOR_TONO: Record<TonoNotificacion, string> = {
  danger: "var(--danger)",
  warning: "var(--warning)",
  info: "var(--info)",
};
