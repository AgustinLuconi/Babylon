import type { VistaPreviaPaseDeAnio } from "../types";

export interface PasoCursosProps {
  vista: VistaPreviaPaseDeAnio;
  copiar: string[];
  onCopiar: (ids: string[]) => void;
}

// Paso 2: qué cursos del origen se copian al destino (con su nombre, nivel, profesor, aula, cupo y horarios).
export function PasoCursos({ vista, copiar, onCopiar }: PasoCursosProps) {
  const alternar = (id: string) => onCopiar(copiar.includes(id) ? copiar.filter((c) => c !== id) : [...copiar, id]);
  const reutiliza = new Map(vista.copias.map((c) => [c.cursoOrigenId, c.reutilizaCursoId]));
  return (
    <div className="space-y-3">
      <p className="text-[12.5px] text-muted-foreground">
        Marcá los cursos que se repiten en {vista.destinoAnio}. Si el ciclo de destino ya tiene un curso con el mismo nombre, se usa ese tal
        como está (no se pisa ni se duplica).
      </p>
      {vista.origen.map((curso) => (
        <label key={curso.id} className="flex items-center justify-between gap-3 rounded-md border p-3 text-sm" style={{ borderColor: "var(--border-hex)" }}>
          <span className="flex items-center gap-2.5">
            <input type="checkbox" checked={copiar.includes(curso.id)} onChange={() => alternar(curso.id)} />
            <span className="font-medium">{curso.nombre}</span>
          </span>
          <span className="text-xs text-muted-foreground">
            {curso.alumnos.length} {curso.alumnos.length === 1 ? "alumno activo" : "alumnos activos"}
            {copiar.includes(curso.id) && reutiliza.get(curso.id) ? " · ya existe en el destino" : ""}
          </span>
        </label>
      ))}
      {vista.origen.length === 0 && <p className="text-sm text-muted-foreground">El ciclo de origen no tiene cursos.</p>}
    </div>
  );
}
