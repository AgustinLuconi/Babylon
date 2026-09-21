import type { ReactNode } from "react";
import { cn } from "@/core/lib/utils";

export interface PanelProps {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function Panel({ title, action, children, className }: PanelProps) {
  return (
    <div className={cn("card-hl", className)}>
      <div
        className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 border-b px-5 py-3.5"
        style={{ borderColor: "var(--border-hex)" }}
      >
        <h3 className="text-[13px] font-semibold" style={{ color: "var(--text)" }}>
          {title}
        </h3>
        {action}
      </div>
      {children}
    </div>
  );
}
