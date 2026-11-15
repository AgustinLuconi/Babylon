import { Select } from "@/core/components/ui/select";
import { destinoDeValor } from "../paseDeAnio";
import type { VistaPreviaPaseDeAnio } from "../types";

export interface DecisionDeCurso {
  destino: string; // ver paseDeAnio.ts
  excepciones: Record<string, string>; // alumnoId → destino ("" = igual que el curso)
}

export interface PasoAlumnosProps {
  vista: VistaPreviaPaseDeAnio;
  copiar: string[];
  decisiones: Record<string, DecisionDeCurso>;
  onDecision: (cursoOrigenId: string, decision: DecisionDeCurso) => void;
}

// Paso 3: a dónde pasan los alumnos de cada curso del origen, con excepciones por alumno (el que repite, el que egresa).
export function PasoAlumnos({ vista, copiar, decisiones, onDecision }: PasoAlumnosProps) {
  const ya = new Map(vista.yaInscriptos.map((y) => [y.alumnoId, y.cursoNombre]));
  const distinto = new Set(vista.avisos.map((a) => a.alumnoId));
  const opciones = (
    <>
      {vista.origen
        .filter((c) => copiar.includes(c.id))
        .map((c) => (
          <option key={`copia:${c.id}`} value={`copia:${c.id}`}>
            Copia de «{c.nombre}»
          </option>
        ))}
      {vista.cursosDestino.map((c) => (
        <option key={`curso:${c.id}`} value={`curso:${c.id}`}>
          {c.nombre} (ya existe en {vista.destinoAnio})
        </option>
      ))}
      <option value="egresan">Egresan</option>
      <option value="no-continuan">No continúan</option>
    </>
  );
  const conAlumnos = vista.origen.filter((c) => c.alumnos.length > 0);
  return (
    <div className="space-y-3">
      <p className="text-[12.5px] text-muted-foreground">
        Cada curso con alumnos activos necesita una decisión. Egresan quedan como egresados y los que no continúan como inactivos; los demás
        pasan al curso que elijas. Abrí la lista para cambiar a un alumno solo.
      </p>
      {conAlumnos.map((curso) => {
        const decision = decisiones[curso.id] ?? { destino: "", excepciones: {} };
        const falta = vista.cursosSinDecision.includes(curso.id);
        return (
          <div key={curso.id} className="space-y-2 rounded-md border p-3" style={{ borderColor: falta ? "var(--danger)" : "var(--border-hex)" }}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-medium">
                {curso.nombre} <span className="text-xs font-normal text-muted-foreground">· {curso.alumnos.length} alumnos</span>
              </span>
              <Select
                aria-label={`Destino de ${curso.nombre}`}
                className="max-w-xs"
                value={decision.destino}
                onChange={(e) => onDecision(curso.id, { ...decision, destino: e.target.value })}
              >
                <option value="">Elegí a dónde pasan…</option>
                {opciones}
              </Select>
            </div>
            <details>
              <summary className="cursor-pointer text-xs text-muted-foreground">Cambiar a un alumno solo</summary>
              <div className="mt-2 space-y-1.5">
                {curso.alumnos.map((alumno) => (
                  <div key={alumno.id} className="flex flex-wrap items-center justify-between gap-2 text-[13px]">
                    <span>
                      {alumno.nombre}
                      {ya.has(alumno.id) && <span className="ml-2 text-xs text-muted-foreground">ya inscripto en {ya.get(alumno.id)}</span>}
                      {distinto.has(alumno.id) && <span className="ml-2 text-xs text-muted-foreground">su curso actual es otro</span>}
                    </span>
                    <Select
                      aria-label={`Destino de ${alumno.nombre}`}
                      className="max-w-xs"
                      value={decision.excepciones[alumno.id] ?? ""}
                      disabled={ya.has(alumno.id)}
                      onChange={(e) => {
                        const excepciones = { ...decision.excepciones, [alumno.id]: e.target.value };
                        if (!destinoDeValor(e.target.value)) delete excepciones[alumno.id];
                        onDecision(curso.id, { ...decision, excepciones });
                      }}
                    >
                      <option value="">Igual que el curso</option>
                      {opciones}
                    </Select>
                  </div>
                ))}
              </div>
            </details>
          </div>
        );
      })}
      {conAlumnos.length === 0 && <p className="text-sm text-muted-foreground">No hay alumnos activos para pasar.</p>}
    </div>
  );
}
