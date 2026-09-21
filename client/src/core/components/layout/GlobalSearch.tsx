import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, X } from "lucide-react";
import { Avatar } from "@/core/components/ui/avatar";
import { formatDni, normalizarTexto } from "@/core/lib/utils";
import { useAlumnos } from "@/features/alumnos/hooks/useAlumnos";

export function GlobalSearch() {
  const { data: alumnos } = useAlumnos();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [abierto, setAbierto] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const alPresionar = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", alPresionar);
    return () => window.removeEventListener("keydown", alPresionar);
  }, []);

  const resultados = useMemo(() => {
    const termino = normalizarTexto(query.trim());
    if (!termino) return [];
    return (alumnos ?? [])
      .filter((a) => normalizarTexto(`${a.nombre} ${a.apellido} ${a.dni}`).includes(termino))
      .slice(0, 6);
  }, [alumnos, query]);

  const irAlumno = (id: string) => {
    navigate(`/alumnos/${id}`);
    setQuery("");
    setAbierto(false);
  };

  return (
    <div className="relative mx-auto min-w-0 max-w-md flex-1 md:mx-0 md:ml-6">
      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setAbierto(true);
        }}
        onFocus={() => setAbierto(true)}
        onBlur={() => setTimeout(() => setAbierto(false), 150)}
        placeholder="Buscar alumnos por nombre o DNI…"
        className="w-full rounded border bg-[var(--bg-subtle)] py-1.5 pl-8 pr-8 text-[13px] outline-none"
        style={{ borderColor: "var(--border-hex)" }}
      />
      {query ? (
        <button
          onClick={() => setQuery("")}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:bg-accent"
        >
          <X size={13} />
        </button>
      ) : (
        <kbd
          className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 rounded-[3px] border bg-background px-1.5 py-px font-mono text-[10px] sm:inline"
          style={{ color: "var(--text-faint)", borderColor: "var(--border-hex)" }}
        >
          ⌘K
        </kbd>
      )}

      {abierto && query && (
        <div
          className="absolute left-0 right-0 top-full z-30 mt-1 overflow-hidden rounded border bg-background shadow-lg"
          style={{ borderColor: "var(--border-hex)" }}
        >
          {resultados.length === 0 && <p className="px-4 py-3 text-[12.5px] text-muted-foreground">Sin resultados</p>}
          {resultados.map((a) => (
            <button
              key={a.id}
              onMouseDown={() => irAlumno(a.id)}
              className="flex w-full items-center gap-2.5 border-b px-3 py-2.5 text-left last:border-b-0 hover:bg-accent"
              style={{ borderColor: "var(--border-hex)" }}
            >
              <Avatar name={`${a.nombre} ${a.apellido}`} size="sm" />
              <div>
                <p className="text-[13px] font-medium">
                  {a.nombre} {a.apellido}
                </p>
                <p className="tnum text-[11px] text-muted-foreground">{formatDni(a.dni)}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
