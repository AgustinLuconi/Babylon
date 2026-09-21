import { useState } from "react";
import { Download, Printer } from "lucide-react";
import { Avatar } from "@/core/components/ui/avatar";
import { Badge } from "@/core/components/ui/badge";
import { Button } from "@/core/components/ui/button";
import { KpiCard } from "@/core/components/ui/kpi-card";
import { Select } from "@/core/components/ui/select";
import { formatMonto } from "@/core/lib/utils";
import { useCiclos } from "@/features/ciclos/hooks/useCiclos";
import { useReporteAlumnos } from "@/features/reportes/hooks/useReporteAlumnos";
import type { NotaCierreResumen, ReporteAlumnoResumen } from "@/features/reportes/types";

type Periodo = "julio" | "noviembre";
type Tab = "cierre" | "anual" | "financiero";

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

function colorNota(nota: number): string {
  if (nota >= 7) return "var(--brand)";
  if (nota >= 5) return "var(--warning)";
  return "var(--danger)";
}

function notaPublicada(nc: NotaCierreResumen | null): number | null {
  return nc && nc.estado === "publicada" ? nc.nota : null;
}

function descargarCsv(headers: string[], filas: (string | number)[][], nombreArchivo: string) {
  const lineas = [headers.join(","), ...filas.map((fila) => fila.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(","))];
  const blob = new Blob([lineas.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${nombreArchivo}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function ExportBar({ onCsv }: { onCsv: () => void }) {
  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="sm" onClick={() => window.print()}>
        <Printer className="mr-1.5" size={13} /> PDF
      </Button>
      <Button variant="outline" size="sm" onClick={onCsv}>
        <Download className="mr-1.5" size={13} /> Excel / CSV
      </Button>
    </div>
  );
}

const TABS: { id: Tab; label: string }[] = [
  { id: "cierre", label: "Cierre académico" },
  { id: "anual", label: "Anual" },
  { id: "financiero", label: "Financiero" },
];

export default function ReportesPage() {
  const { data: ciclos } = useCiclos();
  const cicloActivo = ciclos?.find((c) => c.activo);
  // "activo" es un centinela (no un id real): sigue al ciclo marcado como
  // activo en cada momento, mismo patrón que ya usa CursosAdminPage/Alumnos.
  const [filtroCiclo, setFiltroCiclo] = useState<string>("activo");
  const cicloIdEfectivo = filtroCiclo === "todos" ? undefined : filtroCiclo === "activo" ? cicloActivo?.id : filtroCiclo;

  const { data: filas, isLoading } = useReporteAlumnos(cicloIdEfectivo);
  const [tab, setTab] = useState<Tab>("cierre");
  const [periodo, setPeriodo] = useState<Periodo>("julio");

  const rows = filas ?? [];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          className="flex w-fit items-center gap-1 rounded p-1"
          style={{ background: "var(--bg-muted)", border: "1px solid var(--border-hex)" }}
        >
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className="rounded px-3 py-1.5 text-[12.5px] font-medium transition-all"
              style={{
                background: tab === t.id ? "var(--bg)" : "transparent",
                color: tab === t.id ? "var(--text)" : "var(--text-muted)",
                boxShadow: tab === t.id ? "0 0 0 1px var(--border-hex)" : "none",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        <Select value={filtroCiclo} onChange={(e) => setFiltroCiclo(e.target.value)} className="w-auto">
          <option value="activo">Ciclo activo{cicloActivo ? ` (${cicloActivo.anio})` : ""}</option>
          {ciclos
            ?.filter((c) => !c.activo)
            .map((c) => (
              <option key={c.id} value={c.id}>
                Histórico {c.anio}
              </option>
            ))}
          <option value="todos">Todos los ciclos</option>
        </Select>
      </div>

      {isLoading && <p className="text-muted-foreground">Cargando datos del reporte…</p>}

      {!isLoading && tab === "cierre" && <ReporteCierre rows={rows} periodo={periodo} setPeriodo={setPeriodo} />}
      {!isLoading && tab === "anual" && <ReporteAnual rows={rows} />}
      {!isLoading && tab === "financiero" && <ReporteFinanciero rows={rows} />}
    </div>
  );
}

function ReporteCierre({
  rows,
  periodo,
  setPeriodo,
}: {
  rows: ReporteAlumnoResumen[];
  periodo: Periodo;
  setPeriodo: (p: Periodo) => void;
}) {
  const promedios = rows.map((r) => (periodo === "julio" ? r.promedioJulio : r.promedioNoviembre)).filter((v): v is number => v !== null);
  const promedioInstituto = promedios.length ? (promedios.reduce((a, v) => a + v, 0) / promedios.length).toFixed(1) : "—";
  const pctAprobados = promedios.length ? Math.round((promedios.filter((v) => v >= 7).length / promedios.length) * 100) : 0;
  const asistencias = rows.map((r) => r.asistenciaPct).filter((v): v is number => v !== null);
  const asistenciaProm = asistencias.length ? Math.round(asistencias.reduce((a, v) => a + v, 0) / asistencias.length) : 0;
  const morosos = rows.filter((r) => r.cuotasVencidas > 0).length;

  const exportar = () =>
    descargarCsv(
      ["Alumno", "Curso", "Promedio", "Nota de cierre", "Asistencia %", "Estado cuota"],
      rows.map((r) => {
        const nc = notaPublicada(periodo === "julio" ? r.notaCierreJulio : r.notaCierreNoviembre);
        const promedio = periodo === "julio" ? r.promedioJulio : r.promedioNoviembre;
        return [
          r.alumnoNombre,
          r.cursoNombre ?? "—",
          promedio ?? "—",
          nc ?? "—",
          r.asistenciaPct !== null ? `${r.asistenciaPct}%` : "—",
          r.cuotasVencidas > 0 ? `Adeuda ${r.cuotasVencidas} cuota/s` : "Al día",
        ];
      }),
      `Cierre_${periodo}_${new Date().toLocaleDateString("es-AR")}`,
    );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="eyebrow mr-1">Cierre:</span>
          {(["julio", "noviembre"] as Periodo[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriodo(p)}
              className="rounded px-3 py-1.5 text-[12.5px] font-medium transition-all"
              style={{
                background: periodo === p ? "var(--brand)" : "var(--bg)",
                color: periodo === p ? "#fff" : "var(--text)",
                border: `1px solid ${periodo === p ? "var(--brand)" : "var(--border-hex)"}`,
              }}
            >
              {p === "julio" ? "1° Cierre (Julio)" : "2° Cierre (Noviembre)"}
            </button>
          ))}
        </div>
        <ExportBar onCsv={exportar} />
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="Promedio instituto" value={promedioInstituto} />
        <KpiCard label="Aprobados (≥7)" value={`${pctAprobados}%`} />
        <KpiCard label="Asistencia prom." value={`${asistenciaProm}%`} />
        <KpiCard label="Alumnos morosos" value={String(morosos)} />
      </div>

      <div className="card-hl overflow-x-auto">
        <table className="tbl">
          <thead>
            <tr>
              <th>Alumno</th>
              <th>Curso</th>
              <th>Promedio</th>
              <th>Nota de cierre</th>
              <th>Asistencia</th>
              <th>Cuotas</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const promedio = periodo === "julio" ? r.promedioJulio : r.promedioNoviembre;
              const ncRaw = periodo === "julio" ? r.notaCierreJulio : r.notaCierreNoviembre;
              const nc = notaPublicada(ncRaw);
              const esBorrador = ncRaw && ncRaw.estado === "borrador";
              return (
                <tr key={r.alumnoId}>
                  <td>
                    <div className="flex items-center gap-2.5">
                      <Avatar name={r.alumnoNombre} size="xs" />
                      <span className="font-medium">{r.alumnoNombre}</span>
                    </div>
                  </td>
                  <td style={{ color: "var(--text-muted)" }}>{r.cursoNombre ?? "—"}</td>
                  <td>
                    {promedio !== null ? (
                      <span className="tnum font-semibold" style={{ color: colorNota(promedio) }}>
                        {promedio.toFixed(1)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td>
                    {nc !== null ? (
                      <span className="tnum font-semibold" style={{ color: colorNota(nc) }}>
                        {nc}
                      </span>
                    ) : esBorrador ? (
                      <Badge variant="warning">Borrador</Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td>
                    {r.asistenciaPct !== null ? (
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-12 overflow-hidden rounded-full" style={{ background: "var(--bg-muted)" }}>
                          <div className="h-full rounded-full" style={{ width: `${r.asistenciaPct}%`, background: "var(--brand)" }} />
                        </div>
                        <span className="tnum text-[12px]">{r.asistenciaPct}%</span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td>
                    <Badge variant={r.cuotasVencidas > 0 ? "danger" : "success"}>
                      {r.cuotasVencidas > 0 ? `Adeuda ${r.cuotasVencidas}` : "Al día"}
                    </Badge>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ReporteAnual({ rows }: { rows: ReporteAlumnoResumen[] }) {
  const exportar = () =>
    descargarCsv(
      ["Alumno", "Curso", "Cierre 1°", "Cierre 2°", "Prom Anual", "Asistencia", "Estado financiero", "Promociona"],
      rows.map((r) => {
        const { n1, n2, avgAnual, promueve } = calcularAnual(r);
        return [
          r.alumnoNombre,
          r.cursoNombre ?? "—",
          n1 ?? "—",
          n2 ?? "—",
          avgAnual ?? "—",
          r.asistenciaPct !== null ? `${r.asistenciaPct}%` : "—",
          r.cuotasVencidas > 0 ? `Adeuda ${r.cuotasVencidas}` : "Al día",
          promueve === "si" ? "Sí" : promueve === "no" ? "No" : "A evaluar",
        ];
      }),
      `Reporte_Anual_${new Date().toLocaleDateString("es-AR")}`,
    );

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <ExportBar onCsv={exportar} />
      </div>
      <div className="card-hl overflow-x-auto">
        <table className="tbl">
          <thead>
            <tr>
              <th>Alumno</th>
              <th>Curso</th>
              <th>Cierre 1°</th>
              <th>Cierre 2°</th>
              <th>Prom Anual</th>
              <th>Asistencia</th>
              <th>Financiero</th>
              <th>Promociona</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const { n1, n2, avgAnual, promueve } = calcularAnual(r);
              return (
                <tr key={r.alumnoId}>
                  <td>
                    <div className="flex items-center gap-2.5">
                      <Avatar name={r.alumnoNombre} size="xs" />
                      <span className="font-medium">{r.alumnoNombre}</span>
                    </div>
                  </td>
                  <td style={{ color: "var(--text-muted)" }}>{r.cursoNombre ?? "—"}</td>
                  <td className="tnum font-semibold" style={{ color: n1 !== null ? colorNota(n1) : "var(--text-faint)" }}>
                    {n1 ?? "—"}
                  </td>
                  <td className="tnum font-semibold" style={{ color: n2 !== null ? colorNota(n2) : "var(--text-faint)" }}>
                    {n2 ?? "—"}
                  </td>
                  <td>
                    {avgAnual !== null ? (
                      <span className="tnum" style={{ color: colorNota(avgAnual) }}>
                        {avgAnual.toFixed(1)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td>
                    {r.asistenciaPct !== null ? (
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-12 overflow-hidden rounded-full" style={{ background: "var(--bg-muted)" }}>
                          <div className="h-full rounded-full" style={{ width: `${r.asistenciaPct}%`, background: "var(--brand)" }} />
                        </div>
                        <span className="tnum text-[12px]">{r.asistenciaPct}%</span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td>
                    <Badge variant={r.cuotasVencidas > 0 ? "danger" : "success"}>
                      {r.cuotasVencidas > 0 ? `Adeuda ${r.cuotasVencidas}` : "Al día"}
                    </Badge>
                  </td>
                  <td>
                    {promueve === "si" && <Badge variant="success">Sí</Badge>}
                    {promueve === "no" && <Badge variant="danger">No</Badge>}
                    {promueve === "evaluar" && <Badge variant="warning">A evaluar</Badge>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function calcularAnual(r: ReporteAlumnoResumen) {
  const n1 = notaPublicada(r.notaCierreJulio);
  const n2 = notaPublicada(r.notaCierreNoviembre);
  const avg1 = r.promedioJulio;
  const avg2 = r.promedioNoviembre;
  const avgAnual = avg1 !== null && avg2 !== null ? Math.round(((avg1 + avg2) / 2) * 10) / 10 : avg1 ?? avg2;
  const att = r.asistenciaPct ?? 0;

  let promueve: "si" | "no" | "evaluar" = "evaluar";
  if (n1 !== null && n2 !== null) {
    promueve = n1 >= 6 && n2 >= 6 && att >= 75 ? "si" : n1 < 5 || n2 < 5 || att < 60 ? "no" : "evaluar";
  } else if (n1 !== null) {
    promueve = n1 >= 6 && att >= 75 ? "si" : n1 < 5 || att < 60 ? "no" : "evaluar";
  }

  return { n1, n2, avgAnual, promueve };
}

function ReporteFinanciero({ rows }: { rows: ReporteAlumnoResumen[] }) {
  const recaudado = rows.reduce((a, r) => a + r.montoPagadoTotal, 0);
  const totalAdeudado = rows.reduce((a, r) => a + r.deudaTotal, 0);
  const alDia = rows.filter((r) => r.cuotasVencidas === 0).length;
  const morosos = rows.filter((r) => r.cuotasVencidas > 0).length;

  const exportar = () =>
    descargarCsv(
      ["Alumno", "Curso", "Pagas", "Vencidas", "Adeuda", "Último pago"],
      rows.map((r) => [
        r.alumnoNombre,
        r.cursoNombre ?? "—",
        r.cuotasPagas,
        r.cuotasVencidas,
        r.deudaTotal ? formatMonto(r.deudaTotal) : "—",
        r.ultimoPago ? `${MESES[r.ultimoPago.mes - 1]} ${r.ultimoPago.anio}` : "—",
      ]),
      `Reporte_Financiero_${new Date().toLocaleDateString("es-AR")}`,
    );

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <ExportBar onCsv={exportar} />
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="Recaudado (total)" value={formatMonto(recaudado)} sub={`${rows.reduce((a, r) => a + r.cuotasPagas, 0)} cuotas`} />
        <KpiCard label="Total adeudado" value={formatMonto(totalAdeudado)} />
        <KpiCard label="Al día" value={String(alDia)} sub="alumnos" />
        <KpiCard label="Morosos" value={String(morosos)} sub="alumnos" />
      </div>
      <div className="card-hl overflow-x-auto">
        <table className="tbl">
          <thead>
            <tr>
              <th>Alumno</th>
              <th>Curso</th>
              <th>Pagas</th>
              <th>Vencidas</th>
              <th>Adeuda</th>
              <th>Último pago</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.alumnoId}>
                <td>
                  <div className="flex items-center gap-2.5">
                    <Avatar name={r.alumnoNombre} size="xs" />
                    <span className="font-medium">{r.alumnoNombre}</span>
                  </div>
                </td>
                <td style={{ color: "var(--text-muted)" }}>{r.cursoNombre ?? "—"}</td>
                <td className="tnum" style={{ color: "var(--brand)" }}>
                  {r.cuotasPagas}
                </td>
                <td className="tnum" style={{ color: r.cuotasVencidas ? "var(--danger)" : "var(--text-faint)" }}>
                  {r.cuotasVencidas}
                </td>
                <td className="tnum font-medium" style={{ color: r.deudaTotal ? "var(--danger)" : "var(--text)" }}>
                  {r.deudaTotal ? formatMonto(r.deudaTotal) : "—"}
                </td>
                <td style={{ color: "var(--text-muted)" }}>
                  {r.ultimoPago ? `${MESES[r.ultimoPago.mes - 1]} ${r.ultimoPago.anio}` : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
