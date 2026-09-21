import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Eye, Pencil, UserPlus } from "lucide-react";
import { Input } from "@/core/components/ui/input";
import { Button } from "@/core/components/ui/button";
import { Select } from "@/core/components/ui/select";
import { Badge } from "@/core/components/ui/badge";
import { Avatar } from "@/core/components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/core/components/ui/table";
import { formatDni, normalizarTexto } from "@/core/lib/utils";
import { useCiclos } from "@/features/ciclos/hooks/useCiclos";
import { useCuotas } from "@/features/cuotas/hooks/useCuotas";
import type { EstadoCuota } from "@/features/cuotas/types";
import { usePadres } from "@/features/padres/hooks/usePadres";
import type { Padre } from "@/features/padres/types";
import { useCursos } from "@/features/cursos/hooks/useCursos";
import { NIVEL_GRUPO, NIVEL_LABELS, type Curso } from "@/features/cursos/types";
import { useAlumnos } from "../hooks/useAlumnos";

const CUOTA_VARIANT: Record<EstadoCuota, "success" | "danger"> = {
  pagada: "success",
  vencida: "danger",
};
const CUOTA_LABELS: Record<EstadoCuota, string> = {
  pagada: "Al día",
  vencida: "Vencida",
};

const POR_PAGINA = 8;

export default function AlumnosListPage() {
  const { data: ciclos } = useCiclos();
  const cicloActivo = ciclos?.find((c) => c.activo);
  // "activo" es un centinela (no un id real): sigue al ciclo marcado como
  // activo en cada momento, mismo patrón que ya usa CursosAdminPage.
  const [filtroCiclo, setFiltroCiclo] = useState<string>("activo");
  const cicloIdEfectivo = filtroCiclo === "todos" ? undefined : filtroCiclo === "activo" ? cicloActivo?.id : filtroCiclo;

  const { data: alumnos, isLoading, isError } = useAlumnos(cicloIdEfectivo);
  const { data: padres } = usePadres();
  const { data: cursos } = useCursos();
  const { data: cuotas } = useCuotas();

  const [busqueda, setBusqueda] = useState("");
  const [filtroCuota, setFiltroCuota] = useState<"todas" | EstadoCuota>("todas");
  const [filtroCurso, setFiltroCurso] = useState("todos");
  const [pagina, setPagina] = useState(1);

  const cursosDelCiclo = useMemo(
    () => (cicloIdEfectivo ? (cursos ?? []).filter((c) => c.cicloId === cicloIdEfectivo) : cursos),
    [cursos, cicloIdEfectivo],
  );

  const padresPorId = useMemo(() => {
    const mapa = new Map<string, Padre>();
    for (const padre of padres ?? []) mapa.set(padre.id, padre);
    return mapa;
  }, [padres]);

  const cursosPorId = useMemo(() => {
    const mapa = new Map<string, Curso>();
    for (const curso of cursos ?? []) mapa.set(curso.id, curso);
    return mapa;
  }, [cursos]);

  const estadoCuotaPorAlumno = useMemo(() => {
    const mapa = new Map<string, EstadoCuota>();
    for (const cuota of cuotas ?? []) {
      const actual = mapa.get(cuota.alumnoId);
      // Prioridad: vencida > pagada, para mostrar siempre lo más urgente.
      if (cuota.estado === "vencida") mapa.set(cuota.alumnoId, "vencida");
      else if (!actual) mapa.set(cuota.alumnoId, "pagada");
    }
    return mapa;
  }, [cuotas]);

  const filtrados = useMemo(() => {
    if (!alumnos) return [];
    const termino = normalizarTexto(busqueda.trim());
    return alumnos.filter((alumno) => {
      const matchTexto =
        !termino || normalizarTexto(`${alumno.nombre} ${alumno.apellido} ${alumno.dni}`).includes(termino);
      const matchCuota = filtroCuota === "todas" || estadoCuotaPorAlumno.get(alumno.id) === filtroCuota;
      const matchCurso = filtroCurso === "todos" || alumno.cursoId === filtroCurso;
      return matchTexto && matchCuota && matchCurso;
    });
  }, [alumnos, busqueda, filtroCuota, filtroCurso, estadoCuotaPorAlumno]);

  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / POR_PAGINA));
  const paginaActual = Math.min(pagina, totalPaginas);
  const paginados = filtrados.slice((paginaActual - 1) * POR_PAGINA, paginaActual * POR_PAGINA);

  const actualizarFiltro = <T,>(setter: (v: T) => void) => (valor: T) => {
    setter(valor);
    setPagina(1);
  };

  const paginacion = filtrados.length > 0 && (
    <>
      <span className="text-[12px]" style={{ color: "var(--text-faint)" }}>
        Página {paginaActual} de {totalPaginas}
      </span>
      <div className="flex gap-1">
        <Button variant="outline" size="sm" disabled={paginaActual === 1} onClick={() => setPagina((p) => p - 1)}>
          ← Anterior
        </Button>
        <Button variant="outline" size="sm" disabled={paginaActual === totalPaginas} onClick={() => setPagina((p) => p + 1)}>
          Siguiente →
        </Button>
      </div>
    </>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <Input
            placeholder="Buscar por nombre, apellido o DNI…"
            value={busqueda}
            onChange={(e) => actualizarFiltro(setBusqueda)(e.target.value)}
            className="w-64"
          />
          <Select
            value={filtroCiclo}
            onChange={(e) => {
              actualizarFiltro(setFiltroCiclo)(e.target.value);
              setFiltroCurso("todos");
            }}
            className="w-auto"
          >
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
          <Select
            value={filtroCuota}
            onChange={(e) => actualizarFiltro(setFiltroCuota)(e.target.value as "todas" | EstadoCuota)}
            className="w-auto"
          >
            <option value="todas">Todas las cuotas</option>
            <option value="pagada">Al día</option>
            <option value="vencida">Vencida</option>
          </Select>
          <Select value={filtroCurso} onChange={(e) => actualizarFiltro(setFiltroCurso)(e.target.value)} className="w-auto">
            <option value="todos">Todos los cursos</option>
            {cursosDelCiclo?.map((curso) => (
              <option key={curso.id} value={curso.id}>
                {curso.nombre}
              </option>
            ))}
          </Select>
          <span className="ml-2 text-[12px]" style={{ color: "var(--text-faint)" }}>
            {filtrados.length} alumno{filtrados.length !== 1 ? "s" : ""}
          </span>
        </div>
        <Link to="/alumnos/inscribir">
          <Button>
            <UserPlus size={14} /> Nuevo alumno
          </Button>
        </Link>
      </div>

      <div className="card-hl hidden overflow-hidden md:block">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Alumno</TableHead>
            <TableHead>DNI</TableHead>
            <TableHead>Curso</TableHead>
            <TableHead>Padre/Madre/Tutor</TableHead>
            <TableHead>Teléfono</TableHead>
            <TableHead>Cuota</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading && (
            <TableRow>
              <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                Cargando alumnos…
              </TableCell>
            </TableRow>
          )}
          {isError && (
            <TableRow>
              <TableCell colSpan={7} className="h-24 text-center text-destructive">
                No se pudieron cargar los alumnos.
              </TableCell>
            </TableRow>
          )}
          {!isLoading && !isError && paginados.length === 0 && (
            <TableRow>
              <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                No hay alumnos que coincidan con la búsqueda.
              </TableCell>
            </TableRow>
          )}
          {paginados.map((alumno) => {
            const padre = alumno.padreId ? padresPorId.get(alumno.padreId) : undefined;
            const curso = alumno.cursoId ? cursosPorId.get(alumno.cursoId) : undefined;
            const estadoCuota = estadoCuotaPorAlumno.get(alumno.id);
            return (
              <TableRow key={alumno.id}>
                <TableCell>
                  <div className="flex items-center gap-2.5">
                    <Avatar name={`${alumno.nombre} ${alumno.apellido}`} size="xs" />
                    <div>
                      <div className="font-medium">
                        {alumno.nombre} {alumno.apellido}
                      </div>
                      {alumno.aplicaDescuentoHermanos && (
                        <div className="text-[11px]" style={{ color: "var(--brand)" }}>
                          Hermano inscripto
                        </div>
                      )}
                    </div>
                  </div>
                </TableCell>
                <TableCell className="tnum font-mono" style={{ color: "var(--text-muted)" }}>{formatDni(alumno.dni)}</TableCell>
                <TableCell>
                  {curso && <span className={`level-pill ${NIVEL_GRUPO[curso.nivel]}`}>{NIVEL_LABELS[curso.nivel]}</span>}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {padre ? `${padre.nombre} ${padre.apellido}` : "—"}
                </TableCell>
                <TableCell className="text-muted-foreground">{padre?.telefono ?? "—"}</TableCell>
                <TableCell>
                  {estadoCuota ? (
                    <Badge variant={CUOTA_VARIANT[estadoCuota]}>{CUOTA_LABELS[estadoCuota]}</Badge>
                  ) : (
                    <span className="text-sm text-muted-foreground">Sin cuotas</span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Link
                      to={`/alumnos/${alumno.id}`}
                      title="Ver legajo"
                      className="rounded p-1.5 text-(--text-muted) hover:bg-(--bg-muted)"
                    >
                      <Eye size={14} />
                    </Link>
                    <Link
                      to={`/alumnos/${alumno.id}`}
                      title="Editar"
                      className="rounded p-1.5 text-(--text-muted) hover:bg-(--bg-muted)"
                    >
                      <Pencil size={14} />
                    </Link>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      {paginacion && (
        <div className="flex items-center justify-between px-5 py-3" style={{ borderTop: "1px solid var(--border-hex)" }}>
          {paginacion}
        </div>
      )}
      </div>

      {/* Mobile */}
      <div className="space-y-2.5 md:hidden">
        {isLoading && <p className="card-hl py-10 text-center text-sm text-muted-foreground">Cargando alumnos…</p>}
        {isError && <p className="card-hl py-10 text-center text-sm text-destructive">No se pudieron cargar los alumnos.</p>}
        {!isLoading && !isError && paginados.length === 0 && (
          <p className="card-hl py-10 text-center text-sm text-muted-foreground">No hay alumnos que coincidan con la búsqueda.</p>
        )}
        {paginados.map((alumno) => {
          const padre = alumno.padreId ? padresPorId.get(alumno.padreId) : undefined;
          const curso = alumno.cursoId ? cursosPorId.get(alumno.cursoId) : undefined;
          const estadoCuota = estadoCuotaPorAlumno.get(alumno.id);
          return (
            <div key={alumno.id} className="card-hl p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Avatar name={`${alumno.nombre} ${alumno.apellido}`} size="md" />
                  <div>
                    <p className="text-[14px] font-medium">
                      {alumno.nombre} {alumno.apellido}
                    </p>
                    <p className="tnum text-[11.5px] text-muted-foreground">{formatDni(alumno.dni)}</p>
                  </div>
                </div>
                {estadoCuota ? (
                  <Badge variant={CUOTA_VARIANT[estadoCuota]}>{CUOTA_LABELS[estadoCuota]}</Badge>
                ) : (
                  <span className="text-[11.5px] text-muted-foreground">Sin cuotas</span>
                )}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-y-1.5 border-t pt-3 text-[12px]" style={{ borderColor: "var(--border-hex)" }}>
                <div>{curso && <span className={`level-pill ${NIVEL_GRUPO[curso.nivel]}`}>{NIVEL_LABELS[curso.nivel]}</span>}</div>
                <div className="text-muted-foreground">
                  <span className="text-[11px]">Tutor </span>
                  {padre ? `${padre.nombre} ${padre.apellido}` : "—"}
                </div>
                <div className="col-span-2 text-muted-foreground">
                  <span className="text-[11px]">Tel </span>
                  <span className="tnum">{padre?.telefono ?? "—"}</span>
                </div>
              </div>
              <Link to={`/alumnos/${alumno.id}`}>
                <Button variant="outline" className="mt-3 w-full justify-center">
                  Ver legajo
                </Button>
              </Link>
            </div>
          );
        })}
      </div>

      {paginacion && <div className="flex items-center justify-between md:hidden">{paginacion}</div>}
    </div>
  );
}
