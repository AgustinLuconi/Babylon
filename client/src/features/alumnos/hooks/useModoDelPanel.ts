import { useAuth } from "@/features/auth/hooks/useAuth";
import { modoDelPanel, type ModoDelPanel } from "../modoDelPanel";
import { useMisHijos } from "./useMisHijos";

// Cómo se llama y se arma el panel de esta cuenta (familia, adulto solo o adulto con hijos). Para las demás cuentas no
// pide nada: el modo solo se usa en el menú y los títulos del responsable.
export function useModoDelPanel(): ModoDelPanel {
  const { usuario } = useAuth();
  const { data: cursadas } = useMisHijos({ enabled: usuario?.rol === "padre" });
  return modoDelPanel(cursadas ?? []);
}
