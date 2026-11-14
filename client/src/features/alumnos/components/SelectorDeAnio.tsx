import { Select } from "@/core/components/ui/select";
import type { HistorialDeCurso } from "../types";

export interface SelectorDeAnioProps {
  filas: HistorialDeCurso[] | undefined;
  cursoId: string | null;
  onElegir: (cursoId: string) => void;
}

// Con más de un año en su historial, deja elegir cuál mirar (por defecto, el curso actual). Con uno solo no se muestra.
export function SelectorDeAnio({ filas, cursoId, onElegir }: SelectorDeAnioProps) {
  if (!filas || filas.length < 2 || cursoId === null) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="label" htmlFor="selector-anio">
        Año
      </label>
      <Select id="selector-anio" className="max-w-xs" value={cursoId} onChange={(e) => onElegir(e.target.value)}>
        {filas.map((f) => (
          <option key={f.cicloId} value={f.cursoId}>
            {f.anio} — {f.cursoNombre}
            {f.actual ? " (actual)" : ""}
          </option>
        ))}
      </Select>
    </div>
  );
}
