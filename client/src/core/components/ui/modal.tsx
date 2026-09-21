import type { ReactNode } from "react";
import { X } from "lucide-react";

export interface ModalProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}

export function Modal({ title, onClose, children, footer }: ModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        className="card-hl flex w-full max-w-md flex-col bg-background shadow-lg"
        style={{ maxHeight: "90vh" }}
      >
        <div className="flex items-center justify-between border-b px-5 py-4" style={{ borderColor: "var(--border-hex)" }}>
          <h3 className="text-[14px] font-semibold">{title}</h3>
          <button onClick={onClose} className="rounded p-1 text-muted-foreground hover:bg-accent">
            <X size={16} />
          </button>
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto p-5">{children}</div>
        {footer && (
          <div className="flex gap-2 border-t px-5 py-4" style={{ borderColor: "var(--border-hex)" }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
