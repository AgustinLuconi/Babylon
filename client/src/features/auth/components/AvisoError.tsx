import type { ReactNode } from "react";
import { AlertCircle } from "lucide-react";

// Aviso de error de las pantallas públicas de acceso.
export function AvisoError({ children }: { children: ReactNode }) {
  return (
    <div
      role="alert"
      className="flex items-start gap-2 px-3.5 py-3"
      style={{ background: "var(--danger-soft)", border: "1px solid var(--danger)", borderRadius: 4 }}
    >
      <AlertCircle size={14} style={{ color: "var(--danger)", flexShrink: 0, marginTop: 1 }} />
      <span className="text-[12.5px]" style={{ color: "var(--danger)" }}>
        {children}
      </span>
    </div>
  );
}
