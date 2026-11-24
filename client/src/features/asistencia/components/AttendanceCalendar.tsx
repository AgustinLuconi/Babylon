import { ESTADO_ASISTENCIA_LABELS, etiquetaDeAsistencia, type Asistencia, type EstadoAsistencia } from "../types";

const COLORES: Record<EstadoAsistencia, { bg: string; fg: string; dot: string }> = {
  presente: { bg: "var(--brand-soft)", fg: "var(--brand)", dot: "var(--brand-dot)" },
  tarde: { bg: "var(--warning-soft)", fg: "var(--warning)", dot: "var(--warning-dot)" },
  ausente: { bg: "var(--danger-soft)", fg: "var(--danger)", dot: "var(--danger-dot)" },
};

const INICIALES: Record<EstadoAsistencia, string> = { presente: "P", tarde: "T", ausente: "A" };

// Una ausencia justificada se ve más tenue y con "J".
const COLOR_JUSTIFICADA = { bg: "var(--muted)", fg: "var(--text-muted)" };

const DIAS_SEMANA = ["L", "M", "X", "J", "V", "S", "D"];

// Un día sin clases (una clase que no se dio): no es presente ni ausente, se ve atenuado con "SC".
const COLOR_SIN_CLASES = { bg: "var(--muted)", fg: "var(--text-faint)" };

// `sinClases` (opcional) son las clases que no se dieron; el `motivo` solo viene para el equipo del instituto (a la familia el
// servidor no se lo manda), y si viene se ve en el detalle del día.
export function AttendanceCalendar({
  registros,
  anio,
  mes,
  sinClases,
}: {
  registros: Asistencia[];
  anio: number;
  mes: number;
  sinClases?: { fecha: string; motivo?: string }[];
}) {
  const porDia = new Map<number, Pick<Asistencia, "estado" | "justificada">>();
  for (const r of registros) {
    const [rAnio, rMes, rDia] = r.fecha.slice(0, 10).split("-").map(Number);
    if (rAnio === anio && rMes === mes) porDia.set(rDia, { estado: r.estado, justificada: r.justificada });
  }

  const sinClasesPorDia = new Map<number, { motivo?: string }>();
  for (const c of sinClases ?? []) {
    const [cAnio, cMes, cDia] = c.fecha.slice(0, 10).split("-").map(Number);
    if (cAnio === anio && cMes === mes) sinClasesPorDia.set(cDia, { motivo: c.motivo });
  }

  const diasEnMes = new Date(anio, mes, 0).getDate();
  // getDay(): 0=domingo…6=sábado — se corre a que la semana empiece en lunes.
  const primerDiaSemana = (new Date(anio, mes - 1, 1).getDay() + 6) % 7;
  const hoy = new Date();
  const esMesActual = hoy.getFullYear() === anio && hoy.getMonth() + 1 === mes;

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-x-4 gap-y-1.5 text-[11.5px]">
        {(Object.keys(COLORES) as EstadoAsistencia[]).map((estado) => (
          <span key={estado} className="flex items-center gap-1.5" style={{ color: "var(--text-muted)" }}>
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: COLORES[estado].dot }} />
            {ESTADO_ASISTENCIA_LABELS[estado]}
          </span>
        ))}
        <span className="flex items-center gap-1.5" style={{ color: "var(--text-muted)" }}>
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: COLOR_JUSTIFICADA.fg }} />
          Ausente (justificada)
        </span>
        {sinClases !== undefined && (
          <span className="flex items-center gap-1.5" style={{ color: "var(--text-muted)" }}>
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: COLOR_SIN_CLASES.fg }} />
            Sin clases
          </span>
        )}
      </div>
      <div className="grid gap-1" style={{ gridTemplateColumns: "repeat(7, 1fr)" }}>
        {DIAS_SEMANA.map((d) => (
          <div key={d} className="py-1.5 text-center text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>
            {d}
          </div>
        ))}
        {Array.from({ length: primerDiaSemana }, (_, i) => (
          <div key={`vacio-${i}`} />
        ))}
        {Array.from({ length: diasEnMes }, (_, i) => i + 1).map((dia) => {
          const registro = porDia.get(dia);
          const sinClase = registro ? undefined : sinClasesPorDia.get(dia);
          const estado = registro?.estado;
          const justificada = !!registro && registro.estado === "ausente" && registro.justificada;
          const color = estado ? (justificada ? COLOR_JUSTIFICADA : COLORES[estado]) : sinClase ? COLOR_SIN_CLASES : null;
          const esFuturo = esMesActual && dia > hoy.getDate();
          return (
            <div
              key={dia}
              title={registro ? etiquetaDeAsistencia(registro) : sinClase ? `Sin clases${sinClase.motivo ? `: ${sinClase.motivo}` : ""}` : undefined}
              className="tnum flex aspect-square items-center justify-center text-[12px] font-medium"
              style={{
                background: color?.bg ?? "transparent",
                color: color?.fg ?? (esFuturo ? "var(--text-faint)" : "var(--text)"),
                borderRadius: 3,
              }}
            >
              {estado ? (justificada ? "J" : INICIALES[estado]) : sinClase ? "SC" : dia}
            </div>
          );
        })}
      </div>
      {/* El motivo también a la vista (el cursor encima no existe en un celular). Solo llega al equipo: a la familia no se lo manda el servidor. */}
      {[...sinClasesPorDia.entries()].some(([, c]) => c.motivo) && (
        <ul className="mt-3 space-y-0.5 text-[11.5px]" style={{ color: "var(--text-muted)" }}>
          {[...sinClasesPorDia.entries()]
            .filter(([, c]) => c.motivo)
            .sort(([a], [b]) => a - b)
            .map(([dia, c]) => (
              <li key={dia}>
                <span className="tnum font-medium">Sin clases el {dia}/{mes}:</span> {c.motivo}
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}
