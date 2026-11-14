import { Input } from "@/core/components/ui/input";
import { Select } from "@/core/components/ui/select";
import type { Ciclo } from "../types";

export interface PasoCiclosProps {
  ciclos: Ciclo[];
  origenId: string;
  onOrigen: (id: string) => void;
  destinoModo: "existente" | "nuevo";
  onDestinoModo: (modo: "existente" | "nuevo") => void;
  destinoCicloId: string;
  onDestinoCicloId: (id: string) => void;
  anioNuevo: string;
  onAnioNuevo: (anio: string) => void;
}

// Paso 1: de qué ciclo se pasa y a cuál (uno que ya existe o un año nuevo). Un ciclo bloqueado no se puede elegir.
export function PasoCiclos(p: PasoCiclosProps) {
  const disponibles = p.ciclos.filter((c) => !c.bloqueado);
  return (
    <div className="space-y-5">
      <p className="text-[12.5px] text-muted-foreground">
        El asistente copia los cursos al ciclo siguiente y pasa a los alumnos a su curso nuevo. Los ciclos bloqueados no se pueden usar:
        desbloqueálos antes en Configuración.
      </p>
      <div className="space-y-1.5">
        <label className="label" htmlFor="origen">De qué ciclo se pasa</label>
        <Select id="origen" value={p.origenId} onChange={(e) => p.onOrigen(e.target.value)}>
          <option value="">Elegí el ciclo de origen…</option>
          {disponibles.map((c) => (
            <option key={c.id} value={c.id}>
              {c.anio}
              {c.activo ? " (activo)" : ""}
            </option>
          ))}
        </Select>
      </div>
      <div className="space-y-2">
        <span className="label">A qué ciclo</span>
        <div className="flex gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input type="radio" checked={p.destinoModo === "existente"} onChange={() => p.onDestinoModo("existente")} />
            Un ciclo que ya existe
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" checked={p.destinoModo === "nuevo"} onChange={() => p.onDestinoModo("nuevo")} />
            Un año nuevo
          </label>
        </div>
        {p.destinoModo === "existente" ? (
          <Select aria-label="Ciclo de destino" value={p.destinoCicloId} onChange={(e) => p.onDestinoCicloId(e.target.value)}>
            <option value="">Elegí el ciclo de destino…</option>
            {disponibles
              .filter((c) => c.id !== p.origenId)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.anio}
                  {c.activo ? " (activo)" : ""}
                </option>
              ))}
          </Select>
        ) : (
          <Input type="number" aria-label="Año nuevo" value={p.anioNuevo} onChange={(e) => p.onAnioNuevo(e.target.value)} placeholder="Ej: 2027" />
        )}
      </div>
    </div>
  );
}
