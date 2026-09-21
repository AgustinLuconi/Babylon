import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQueries } from "@tanstack/react-query";
import { ClipboardCheck, FileText } from "lucide-react";
import { Button } from "@/core/components/ui/button";
import { KpiCard } from "@/core/components/ui/kpi-card";
import { Panel } from "@/core/components/ui/panel";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { cursoService } from "../cursoService";
import { useCursosDelCicloActivo } from "../hooks/useCursosDelCicloActivo";
import { formatFechaLarga } from "@/core/lib/utils";
import { useHorarios } from "../hooks/useHorarios";
import { NIVEL_GRUPO, NIVEL_LABELS, type DiaSemana, type Horario } from "../types";

const DIAS_ORDEN: DiaSemana[] = ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado"];
const DIA_ABREVIADO: Record<DiaSemana, string> = {
  lunes: "Lun",
  martes: "Mar",
  miercoles: "Mié",
  jueves: "Jue",
  viernes: "Vie",
  sabado: "Sáb",
};

// "Lun/Mié 18:00" cuando todos los días comparten hora; si no, día por día.
function resumirHorarios(horarios: Horario[]): string {
  if (horarios.length === 0) return "Sin horarios cargados";
  const ordenados = [...horarios].sort((a, b) => DIAS_ORDEN.indexOf(a.diaSemana) - DIAS_ORDEN.indexOf(b.diaSemana));
  const mismaHora = ordenados.every((h) => h.horaInicio === ordenados[0].horaInicio);
  if (mismaHora) return `${ordenados.map((h) => DIA_ABREVIADO[h.diaSemana]).join("/")} ${ordenados[0].horaInicio}`;
  return ordenados.map((h) => `${DIA_ABREVIADO[h.diaSemana]} ${h.horaInicio}`).join(" · ");
}

const diaAbreviadoDe = (fecha: Date) => DIA_ABREVIADO[DIAS_ORDEN[(fecha.getDay() + 6) % 7]] ?? "Dom";
const esHoy = (fecha: Date) => fecha.toDateString() === new Date().toDateString();

function proximaOcurrencia(horario: Horario): Date {
  const hoy = new Date();
  const objetivoDiaJs = DIAS_ORDEN.indexOf(horario.diaSemana) + 1;
  let delta = objetivoDiaJs - hoy.getDay();
  if (delta < 0) delta += 7;
  if (delta === 0) {
    const [h, m] = horario.horaInicio.split(":").map(Number);
    const horaHoy = new Date(hoy);
    horaHoy.setHours(h, m, 0, 0);
    if (horaHoy < hoy) delta = 7;
  }
  const resultado = new Date(hoy);
  resultado.setDate(hoy.getDate() + delta);
  return resultado;
}

export default function MisCursosPage() {
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const { data: cursos, isLoading, isError } = useCursosDelCicloActivo();
  const { data: horarios } = useHorarios();

  const horariosPorCurso = useMemo(() => {
    const mapa = new Map<string, Horario[]>();
    for (const h of horarios ?? []) {
      const lista = mapa.get(h.cursoId) ?? [];
      lista.push(h);
      mapa.set(h.cursoId, lista);
    }
    return mapa;
  }, [horarios]);

  const alumnosQueries = useQueries({
    queries: (cursos ?? []).map((c) => ({
      queryKey: ["cursos", c.id, "alumnos"],
      queryFn: () => cursoService.listarAlumnos(c.id),
    })),
  });

  const totalAlumnos = alumnosQueries.reduce((a, q) => a + (q.data?.length ?? 0), 0);

  const hoy = formatFechaLarga();
  const hora = new Date().getHours();
  const saludo = hora < 12 ? "Buen día" : hora < 20 ? "Buenas tardes" : "Buenas noches";

  const proximasClases = useMemo(() => {
    const clases: { cursoId: string; cursoNombre: string; fecha: Date; horaInicio: string; aula?: string; count: number }[] = [];
    (cursos ?? []).forEach((curso, i) => {
      const hs = horariosPorCurso.get(curso.id) ?? [];
      for (const h of hs) {
        clases.push({
          cursoId: curso.id,
          cursoNombre: curso.nombre,
          fecha: proximaOcurrencia(h),
          horaInicio: h.horaInicio,
          aula: curso.aula,
          count: alumnosQueries[i]?.data?.length ?? 0,
        });
      }
    });
    return clases.sort((a, b) => a.fecha.getTime() - b.fecha.getTime() || a.horaInicio.localeCompare(b.horaInicio)).slice(0, 5);
  }, [cursos, horariosPorCurso, alumnosQueries]);

  // Clases que quedan desde hoy hasta el domingo de esta semana.
  const semana = useMemo(() => {
    const fin = new Date();
    fin.setDate(fin.getDate() + ((7 - fin.getDay()) % 7));
    fin.setHours(23, 59, 59, 999);
    let clases = 0;
    const comisiones = new Set<string>();
    for (const curso of cursos ?? []) {
      for (const h of horariosPorCurso.get(curso.id) ?? []) {
        if (proximaOcurrencia(h) <= fin) {
          clases++;
          comisiones.add(curso.id);
        }
      }
    }
    return { clases, comisiones: comisiones.size };
  }, [cursos, horariosPorCurso]);

  return (
    <div className="space-y-7">
      <div>
        <p className="eyebrow mb-2 capitalize">{hoy}</p>
        <h2 className="text-[26px] font-semibold leading-tight tracking-tight">
          {saludo}, {usuario?.nombre.split(" ")[0]}
        </h2>
        {cursos && (
          <p className="mt-1.5 text-[13.5px] text-muted-foreground">
            {semana.clases > 0 ? (
              <>
                Tenés <span className="font-medium text-foreground">{semana.clases}</span> clase{semana.clases !== 1 ? "s" : ""}{" "}
                esta semana entre {semana.comisiones} comisión{semana.comisiones !== 1 ? "es" : ""}
              </>
            ) : (
              <>
                Tenés <span className="font-medium text-foreground">{cursos.length}</span> comisión
                {cursos.length !== 1 ? "es" : ""} a cargo
              </>
            )}{" "}
            — {totalAlumnos} alumno{totalAlumnos !== 1 ? "s" : ""} en total.
          </p>
        )}
      </div>

      {isError && <p className="text-sm text-destructive">No se pudieron cargar tus cursos.</p>}

      {cursos && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <KpiCard
            label="Comisiones a cargo"
            value={String(cursos.length)}
            sub={
              cursos.length > 3
                ? `${cursos.slice(0, 2).map((c) => c.nombre).join(" · ")} · +${cursos.length - 2} más`
                : cursos.map((c) => c.nombre).join(" · ") || undefined
            }
          />
          <KpiCard label="Alumnos totales" value={String(totalAlumnos)} sub="entre tus cursos" />
          <KpiCard
            label="Próxima clase"
            value={proximasClases[0] ? (esHoy(proximasClases[0].fecha) ? "Hoy" : diaAbreviadoDe(proximasClases[0].fecha)) : "—"}
            sub={
              proximasClases[0] ? (
                <>
                  <span className="font-medium" style={{ color: "var(--text)" }}>
                    {proximasClases[0].cursoNombre}
                  </span>{" "}
                  {proximasClases[0].horaInicio}
                  {proximasClases[0].aula ? ` · Aula ${proximasClases[0].aula}` : ""}
                </>
              ) : (
                "sin horarios cargados"
              )
            }
          />
        </div>
      )}

      <div>
        <h3 className="mb-3 text-[13px] font-semibold">Mis cursos</h3>
        {isLoading && <p className="text-muted-foreground">Cargando cursos…</p>}
        {!isLoading && cursos?.length === 0 && <p className="text-muted-foreground">Todavía no tenés cursos asignados.</p>}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {cursos?.map((curso, i) => {
            const hs = horariosPorCurso.get(curso.id) ?? [];
            return (
              <div key={curso.id} className="card-hl p-5">
                <div className="mb-3 flex items-start justify-between">
                  <span className={`level-pill ${NIVEL_GRUPO[curso.nivel]}`}>{NIVEL_LABELS[curso.nivel]}</span>
                  {curso.aula && <span className="text-[11.5px] text-muted-foreground">Aula {curso.aula}</span>}
                </div>
                <h4 className="text-[15px] font-semibold tracking-tight">{curso.nombre}</h4>
                <p className="mt-1 text-[12px] text-muted-foreground">
                  {resumirHorarios(hs)} ·{" "}
                  <span className="tnum">{alumnosQueries[i]?.data?.length ?? 0}</span> alumnos
                </p>
                <div className="mt-4 flex gap-2 border-t pt-4" style={{ borderColor: "var(--border-hex)" }}>
                  <Button className="flex-1" onClick={() => navigate("/asistencia")}>
                    <ClipboardCheck className="mr-1.5" size={13} /> Asistencia
                  </Button>
                  <Button variant="outline" className="flex-1" onClick={() => navigate("/calificaciones")}>
                    <FileText className="mr-1.5" size={13} /> Notas
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <Panel title="Próximas clases">
        {proximasClases.length === 0 && (
          <p className="px-5 py-6 text-center text-sm text-muted-foreground">No hay horarios cargados para tus cursos.</p>
        )}
        {proximasClases.map((cl, i, arr) => (
          <div
            key={`${cl.cursoId}-${i}`}
            className="flex items-center gap-4 px-5 py-3"
            style={{ borderBottom: i < arr.length - 1 ? "1px solid var(--border-hex)" : "none" }}
          >
            <div className="flex-shrink-0 text-center" style={{ width: 56 }}>
              <p className="tnum text-[13px] font-semibold leading-none">{cl.horaInicio}</p>
              <p className="mt-1.5 text-[11px] text-muted-foreground">
                {diaAbreviadoDe(cl.fecha)} {String(cl.fecha.getDate()).padStart(2, "0")}/{String(cl.fecha.getMonth() + 1).padStart(2, "0")}
              </p>
            </div>
            <div className="min-w-0 flex-1 border-l pl-4" style={{ borderColor: "var(--border-hex)" }}>
              <p className="text-[13px] font-medium">{cl.cursoNombre}</p>
              <p className="mt-0.5 text-[11.5px] text-muted-foreground">
                {cl.aula ? `Aula ${cl.aula} · ` : ""}
                <span className="tnum">{cl.count}</span> alumnos
              </p>
            </div>
            <Button variant="outline" size="sm" className="flex-shrink-0" onClick={() => navigate("/asistencia")}>
              Tomar asistencia
            </Button>
          </div>
        ))}
      </Panel>
    </div>
  );
}
