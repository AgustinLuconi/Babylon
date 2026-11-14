import { Badge } from "@/core/components/ui/badge";
import { Panel } from "@/core/components/ui/panel";
import { formatFecha } from "@/core/lib/utils";
import { useHistorialDeCursos } from "../hooks/useHistorialDeCursos";

// Legajo: en qué curso estuvo el alumno cada año (sale de sus inscripciones; los años anteriores no cambian).
export function HistorialDeCursos({ alumnoId }: { alumnoId: string }) {
  const { data: filas, isLoading, isError } = useHistorialDeCursos(alumnoId);
  return (
    <Panel title="Historial de cursos">
      {isLoading && <p className="p-5 text-sm text-muted-foreground">Cargando…</p>}
      {isError && <p className="p-5 text-sm text-destructive">No se pudo cargar el historial de cursos</p>}
      {filas && filas.length === 0 && <p className="p-5 text-sm text-muted-foreground">Todavía no tiene inscripciones registradas.</p>}
      {filas && filas.length > 0 && (
        <div className="overflow-x-auto">
          <table className="tbl">
            <thead>
              <tr>
                <th>Año</th>
                <th>Curso</th>
                <th>Inscripto</th>
                <th>Descuento</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((f) => (
                <tr key={f.cicloId}>
                  <td className="tnum">{f.anio}</td>
                  <td>
                    {f.cursoNombre} {f.actual && <Badge variant="success">Actual</Badge>}
                  </td>
                  <td className="tnum">{formatFecha(f.fecha)}</td>
                  <td>{f.aplicaDescuentoHermanos ? "10%" : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}
