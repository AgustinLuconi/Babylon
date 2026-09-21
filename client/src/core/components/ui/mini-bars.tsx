export interface MiniBarsProps {
  data: number[];
  labels: string[];
  colors?: string[];
  height?: number;
}

export function MiniBars({ data, labels, colors, height = 80 }: MiniBarsProps) {
  const max = Math.max(1, ...data);
  return (
    <div className="flex items-end gap-1" style={{ height }}>
      {data.map((v, i) => {
        const h = (v / max) * 100;
        const c = colors?.[i];
        return (
          <div key={i} className="flex flex-1 flex-col items-center gap-1.5" style={{ height: "100%" }}>
            <div className="relative w-full" style={{ height: "100%" }}>
              <div
                className="absolute bottom-0 left-0 right-0"
                style={{
                  height: `${h}%`,
                  background: c ? `${c}1f` : "var(--brand-soft)",
                  borderTop: c ? `2px solid ${c}` : "2px solid var(--brand)",
                }}
              />
            </div>
            <span className="text-[10px]" style={{ color: "var(--text-faint)" }}>
              {labels[i]}
            </span>
          </div>
        );
      })}
    </div>
  );
}
