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

// Teclado del modal.
// - Enter en un campo de texto aprieta su botón principal: el último botón del pie (por convención, "Cancelar" va primero y la
//   acción al final). Se respeta el estado del botón (si está deshabilitado, Enter no hace nada) y no se toca lo que ya tiene su
//   propio Enter: áreas de texto (salto de línea), botones, enlaces, casillas y listas. Un campo de búsqueda puede excluirse con
//   `data-sin-enter` (por ejemplo el buscador de alumnos del cobro: ahí Enter es buscar, no cobrar). Un botón que solo elige una
//   opción (una cuota, un método de pago) se marca con `data-enter-envia`: igual que una casilla, Espacio lo marca y Enter confirma.
// - Las flechas mueven el foco entre los campos: abajo/arriba desde un campo de texto o una casilla; abajo/derecha y arriba/izquierda
//   desde un botón. Fechas, números, listas desplegables y áreas de texto conservan sus propias flechas (Tab sale de ahí).
const TIPOS_SIN_ENTER = new Set(["checkbox", "radio", "button", "submit", "file", "search"]);
const TIPOS_CON_FLECHAS = new Set(["text", "email", "password", "search", "tel", "url", "checkbox"]);
const ENFOCABLES = "input:not([disabled]):not([type=hidden]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), a[href]";

export function Modal({ title, onClose, children, footer, sinGuardar = false }: ModalProps) {
  const tarjeta = useRef<HTMLDivElement>(null);
  const pie = useRef<HTMLDivElement>(null);
  const cerrar = () => {
    if (!sinGuardar) return onClose();
    void confirmarSalida().then((salir) => salir && onClose());
  };
  const confirmar = (e: KeyboardEvent<HTMLDivElement>) => {
    const principal = [...(pie.current?.querySelectorAll("button") ?? [])].at(-1);
    if (!principal || principal.disabled) return;
    e.preventDefault();
    principal.click();
  };
  const moverFoco = (e: KeyboardEvent<HTMLDivElement>, campo: HTMLElement, sentido: 1 | -1) => {
    const campos = [...(tarjeta.current?.querySelectorAll<HTMLElement>(ENFOCABLES) ?? [])].filter((c) => c.getClientRects().length > 0);
    const destino = campos[campos.indexOf(campo) + sentido];
    if (!destino) return;
    e.preventDefault();
    destino.focus();
  };
  const alApretarTecla = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.nativeEvent.isComposing) return;
    const campo = e.target as HTMLElement;
    const esBoton = campo.tagName === "BUTTON";
    const input = campo as HTMLInputElement;
    if (e.key === "Enter") {
      if (e.shiftKey) return;
      if (esBoton ? campo.hasAttribute("data-enter-envia") : campo.tagName === "INPUT" && !TIPOS_SIN_ENTER.has(input.type) && !input.hasAttribute("data-sin-enter")) confirmar(e);
      return;
    }
    if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    if (esBoton) {
      if (e.key === "ArrowDown" || e.key === "ArrowRight") moverFoco(e, campo, 1);
      else if (e.key === "ArrowUp" || e.key === "ArrowLeft") moverFoco(e, campo, -1);
    } else if (campo.tagName === "INPUT" && TIPOS_CON_FLECHAS.has(input.type)) {
      if (e.key === "ArrowDown") moverFoco(e, campo, 1);
      else if (e.key === "ArrowUp") moverFoco(e, campo, -1);
    }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        ref={tarjeta}
        className="card-hl flex w-full max-w-md flex-col bg-background shadow-lg"
        style={{ maxHeight: "90vh" }}
        onKeyDown={alApretarTecla}
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
