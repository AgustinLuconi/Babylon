import { useRef, type KeyboardEvent, type ReactNode } from "react";
import { X } from "lucide-react";
import { confirmarSalida } from "@/core/sinGuardar/sinGuardar";

export interface ModalProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  // Con algo escrito y sin guardar, la cruz pregunta antes de cerrar.
  sinGuardar?: boolean;
}

// Enter en un campo de texto del modal aprieta su botón principal: el último botón del pie (por convención, "Cancelar" va
// primero y la acción al final). Se respeta el estado del botón (si está deshabilitado, Enter no hace nada) y no se toca
// lo que ya tiene su propio Enter: áreas de texto (salto de línea), botones, enlaces, casillas y listas. Un campo de búsqueda
// puede excluirse con `data-sin-enter` (por ejemplo el buscador de alumnos del cobro: ahí Enter no debe cobrar).
const TIPOS_SIN_ENTER = new Set(["checkbox", "radio", "button", "submit", "file", "search"]);

export function Modal({ title, onClose, children, footer, sinGuardar = false }: ModalProps) {
  const pie = useRef<HTMLDivElement>(null);
  const cerrar = () => {
    if (!sinGuardar) return onClose();
    void confirmarSalida().then((salir) => salir && onClose());
  };
  const alApretarEnter = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "Enter" || e.shiftKey || e.nativeEvent.isComposing) return;
    const campo = e.target as HTMLElement;
    if (campo.tagName !== "INPUT") return;
    const input = campo as HTMLInputElement;
    if (TIPOS_SIN_ENTER.has(input.type) || input.hasAttribute("data-sin-enter")) return;
    const principal = [...(pie.current?.querySelectorAll("button") ?? [])].at(-1);
    if (!principal || principal.disabled) return;
    e.preventDefault();
    principal.click();
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        className="card-hl flex w-full max-w-md flex-col bg-background shadow-lg"
        style={{ maxHeight: "90vh" }}
        onKeyDown={alApretarEnter}
      >
        <div className="flex items-center justify-between border-b px-5 py-4" style={{ borderColor: "var(--border-hex)" }}>
          <h3 className="text-[14px] font-semibold">{title}</h3>
          <button onClick={cerrar} aria-label="Cerrar" className="rounded p-1 text-muted-foreground hover:bg-accent">
            <X size={16} />
          </button>
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto p-5">{children}</div>
        {footer && (
          <div ref={pie} className="flex gap-2 border-t px-5 py-4" style={{ borderColor: "var(--border-hex)" }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
