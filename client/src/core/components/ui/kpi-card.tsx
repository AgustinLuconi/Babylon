import type { ReactNode } from "react";

export type TonoDelta = "positive" | "negative" | "neutral";

export interface KpiCardProps {
  label: string;
  value: string;
  sub?: ReactNode;
  delta?: string;
  deltaTone?: TonoDelta;
  onClick?: () => void;
}

const COLOR_DELTA: Record<TonoDelta, string> = {
  positive: "var(--brand)",
  negative: "var(--danger)",
  neutral: "var(--text-muted)",
};

export function KpiCard({ label, value, sub, delta, deltaTone = "positive", onClick }: KpiCardProps) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      onClick={onClick}
      className={`card-hl flex w-full flex-col items-stretch justify-start text-left transition-colors ${onClick ? "cursor-pointer hover:border-(--border-strong)" : ""}`}
      style={{ padding: "18px 18px 16px" }}
    >
      <div className="eyebrow">{label}</div>
      <div className="num-display mt-2.5" style={{ fontSize: 30, lineHeight: "1", color: "var(--text)" }}>
        {value}
      </div>
      {(delta || sub) && (
        <div className="mt-3 flex items-center gap-2">
          {delta && (
            <span className="tnum text-[12px] font-medium" style={{ color: COLOR_DELTA[deltaTone] }}>
              {delta}
            </span>
          )}
          {sub && (
            <span className="text-[12px]" style={{ color: "var(--text-faint)" }}>
              {sub}
            </span>
          )}
        </div>
      )}
    </Tag>
  );
}
