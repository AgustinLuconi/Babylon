import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/core/components/ui/button";
import { formatFechaHora } from "@/core/lib/utils";
import { useAlertasDeRegla } from "../hooks/useAlertasDeRegla";
import { MOTIVO_LABELS, type ReglaId } from "../types";

// Las alertas de una regla, las más nuevas primero (el registro es permanente, la campana guarda solo 30 días).
export function HistorialDeAlertas({ regla }: { regla: ReglaId }) {
  const [pagina, setPagina] = useState(1);
  const { data, isLoading, isError } = useAlertasDeRegla(regla, pagina);
  const totalPaginas = data ? Math.max(1, Math.ceil(data.total / data.porPagina)) : 1;

  if (isLoading) return <p className="p-4 text-sm text-muted-foreground">Cargando…</p>;
  if (isError || !data) return <p className="p-4 text-sm text-destructive">No se pudo cargar el historial</p>;
  if (data.total === 0) return <p className="p-4 text-sm text-muted-foreground">Todavía no hubo alertas.</p>;

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="tbl">
          <thead>
            <tr>
              <th>Alumno o evaluación</th>
              <th>Curso</th>
              <th>Nivel</th>
              <th>Abierta</th>
              <th>Resuelta</th>
              <th>Motivo</th>
            </tr>
          </thead>
          <tbody>
            {data.alertas.map((a) => (
              <tr key={a.id}>
                <td>
                  {a.alumnoId ? (
                    <Link to={`/alumnos/${a.alumnoId}`} className="underline">
                      {a.alumnoNombre}
                    </Link>
                  ) : (
                    (a.evaluacionNombre ?? "—")
                  )}
                </td>
                <td>{a.cursoNombre ?? "—"}</td>
                <td className="tnum">{a.nivel}</td>
                <td className="tnum">{formatFechaHora(a.abiertaEn)}</td>
                <td className="tnum">{a.resueltaEn ? formatFechaHora(a.resueltaEn) : "Abierta"}</td>
                <td>{a.motivoCierre ? MOTIVO_LABELS[a.motivoCierre] : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {totalPaginas > 1 && (
        <div className="flex items-center justify-between gap-2 border-t px-4 py-3 text-[12px] text-muted-foreground" style={{ borderColor: "var(--border-hex)" }}>
          <span>
            Página {pagina} de {totalPaginas} · {data.total} alertas
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={pagina === 1} onClick={() => setPagina(pagina - 1)}>
              Anterior
            </Button>
            <Button variant="outline" size="sm" disabled={pagina === totalPaginas} onClick={() => setPagina(pagina + 1)}>
              Siguiente
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
