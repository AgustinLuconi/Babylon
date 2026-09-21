import { useNavigate } from "react-router-dom";
import { DollarSign, Search } from "lucide-react";
import { Avatar } from "@/core/components/ui/avatar";
import { Button } from "@/core/components/ui/button";
import { Panel } from "@/core/components/ui/panel";
import { formatFechaLarga, formatMonto } from "@/core/lib/utils";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { useResumenDashboard } from "@/features/reportes/hooks/useResumenDashboard";
import { NIVEL_GRUPO, type NivelCurso } from "@/features/cursos/types";

export default function SecretarioDashboard() {
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const { data: resumen, isLoading } = useResumenDashboard();

  const hoy = formatFechaLarga();
  const hora = new Date().getHours();
  const saludo = hora < 12 ? "Buenos días" : hora < 20 ? "Buenas tardes" : "Buenas noches";

  const totalVencido = resumen?.cuotasVencidas.reduce((a, f) => a + f.monto, 0) ?? 0;

  return (
    <div className="space-y-7">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow mb-2 capitalize">{hoy}</p>
          <h2 className="text-[26px] font-semibold leading-tight tracking-tight">
            {saludo}, {usuario?.nombre.split(" ")[0]}
          </h2>
          {resumen && (
            <p className="mt-1.5 text-[13.5px] text-muted-foreground">
              {resumen.cuotasVencidas.length > 0
                ? `Hay ${resumen.cuotasVencidas.length} cuota${resumen.cuotasVencidas.length !== 1 ? "s" : ""} vencida${resumen.cuotasVencidas.length !== 1 ? "s" : ""} por ${formatMonto(totalVencido)} para gestionar hoy.`
                : "No hay cuotas vencidas pendientes de gestionar."}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate("/alumnos")}>
            <Search className="mr-1.5" size={14} /> Buscar alumno
          </Button>
          <Button onClick={() => navigate("/cuotas")}>
            <DollarSign className="mr-1.5" size={14} /> Registrar pago
          </Button>
        </div>
      </div>

      {!isLoading && resumen && (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <button
              onClick={() => navigate("/cuotas")}
              className="card-hl text-left transition-colors hover:border-(--border-strong)"
              style={{ padding: "18px 18px 16px" }}
            >
              <div className="flex items-center gap-2">
                <span className="eyebrow flex-1">Cuotas vencidas</span>
                <span className="h-2 w-2 rounded-full" style={{ background: "var(--danger-dot)" }} />
              </div>
              <div className="num-display mt-2.5" style={{ fontSize: 26, color: "var(--danger)" }}>
                {formatMonto(totalVencido)}
              </div>
              <div className="mt-2 text-[12px] text-muted-foreground">
                {resumen.cuotasVencidas.length} cuota{resumen.cuotasVencidas.length !== 1 ? "s" : ""} ·{" "}
                {new Set(resumen.cuotasVencidas.map((f) => f.alumnoId)).size} alumnos
              </div>
            </button>

            <div className="card-hl" style={{ padding: "18px 18px 16px" }}>
              <div className="flex items-center gap-2">
                <span className="eyebrow flex-1">Cobros hoy</span>
                <span className="h-2 w-2 rounded-full" style={{ background: "var(--brand-dot)" }} />
              </div>
              <div className="num-display mt-2.5" style={{ fontSize: 26 }}>
                {formatMonto(resumen.cobradoHoyMonto)}
              </div>
              <div className="mt-2 text-[12px] text-muted-foreground">
                {resumen.cobradoHoyCount} pago{resumen.cobradoHoyCount !== 1 ? "s" : ""} registrado
                {resumen.cobradoHoyCount !== 1 ? "s" : ""}
              </div>
            </div>

            <button
              onClick={() => navigate("/alumnos")}
              className="card-hl text-left transition-colors hover:border-(--border-strong)"
              style={{ padding: "18px 18px 16px" }}
            >
              <div className="flex items-center gap-2">
                <span className="eyebrow flex-1">Documentación pendiente</span>
                <span className="h-2 w-2 rounded-full" style={{ background: "var(--warning-dot)" }} />
              </div>
              <div className="num-display mt-2.5" style={{ fontSize: 26 }}>
                {resumen.documentacionPendienteCount}
              </div>
              <div className="mt-2 text-[12px] text-muted-foreground">alumnos con autorización de imagen pendiente</div>
            </button>
          </div>

          <Panel
            title="Cuotas vencidas urgentes"
            action={
              <button
                onClick={() => navigate("/cuotas")}
                className="text-[12px] font-medium hover:underline"
                style={{ color: "var(--brand)" }}
              >
                Ver todas →
              </button>
            }
          >
            {resumen.cuotasVencidas.length === 0 && (
              <p className="px-5 py-6 text-center text-sm text-muted-foreground">No hay cuotas vencidas.</p>
            )}
            {resumen.cuotasVencidas.length > 0 && (
              <>
                {/* Desktop */}
                <div className="hidden overflow-x-auto md:block">
                  <table className="tbl">
                    <thead>
                      <tr>
                        <th>Alumno</th>
                        <th>Curso</th>
                        <th>Mes</th>
                        <th style={{ textAlign: "right" }}>Atraso</th>
                        <th style={{ textAlign: "right" }}>Monto</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {resumen.cuotasVencidas.map((f, i) => (
                        <tr key={i}>
                          <td>
                            <div className="flex items-center gap-2.5">
                              <Avatar name={f.alumnoNombre} size="xs" />
                              <span className="font-medium">{f.alumnoNombre}</span>
                            </div>
                          </td>
                          <td>
                            {f.cursoNivel && (
                              <span className={`level-pill ${NIVEL_GRUPO[f.cursoNivel as NivelCurso]}`}>{f.cursoNombre}</span>
                            )}
                          </td>
                          <td style={{ color: "var(--text-muted)" }}>
                            {f.mes}/{f.anio}
                          </td>
                          <td
                            className="tnum"
                            style={{ textAlign: "right", color: f.diasVencido >= 30 ? "var(--danger)" : "var(--warning)" }}
                          >
                            {f.diasVencido} d.
                          </td>
                          <td className="tnum font-medium" style={{ textAlign: "right" }}>
                            {formatMonto(f.monto)}
                          </td>
                          <td style={{ textAlign: "right" }}>
                            <Button size="sm" onClick={() => navigate("/cuotas")}>
                              Registrar pago
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {/* Mobile */}
                <div className="md:hidden">
                  {resumen.cuotasVencidas.map((f, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-3 px-5 py-3"
                      style={{ borderBottom: i < resumen.cuotasVencidas.length - 1 ? "1px solid var(--border-hex)" : "none" }}
                    >
                      <Avatar name={f.alumnoNombre} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-medium">{f.alumnoNombre}</p>
                        <p className="text-[11.5px] text-muted-foreground">
                          {f.cursoNombre} · {f.mes}/{f.anio}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="tnum text-[13px] font-medium">{formatMonto(f.monto)}</p>
                        <Button size="sm" className="mt-1" onClick={() => navigate("/cuotas")}>
                          Cobrar
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </Panel>
        </>
      )}
    </div>
  );
}
