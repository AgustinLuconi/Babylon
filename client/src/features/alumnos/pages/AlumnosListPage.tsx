import { useEffect, useMemo, useState } from "react";
import { claseDeFila, useListaConSalidas } from "@/core/hooks/useListaConSalidas";
import { Link, useLocation, useNavigate } from "react-router-dom";
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
import { estadoMasUrgente, type Cuota, type EstadoCuota } from "@/features/cuotas/types";
import { usePadres } from "@/features/padres/hooks/usePadres";
import type { Padre } from "@/features/padres/types";
import { useCursos } from "@/features/cursos/hooks/useCursos";
import { NIVEL_GRUPO, type Curso } from "@/features/cursos/types";
import { elegir, useFiltrosDeUrl } from "@/core/hooks/useFiltrosDeUrl";
import { useDocumentosFaltantes } from "@/features/documentos/hooks/useDocumentosFaltantes";
import type { TipoDocumento } from "@/features/documentos/types";
import { useAlumnos } from "../hooks/useAlumnos";

const CUOTA_VARIANT: Record<EstadoCuota, "success" | "warning" | "danger"> = {
  pagada: "success",
  pendiente: "warning",
  vencida: "danger",
};
const CUOTA_LABELS: Record<EstadoCuota, string> = {
  pagada: "Al día",
  pendiente: "Pendiente",
  vencida: "Vencida",
};

const POR_PAGINA = 8;
const FILTROS_CUOTA = ["todas", "pagada", "pendiente", "vencida"] as const;
const FILTROS_DOCUMENTACION = ["todos", "pendiente", "formulario_inscripcion", "copia_dni", "autorizacion_imagen"] as const;
const FALTA_CORTO: Record<TipoDocumento, string> = { formulario_inscripcion: "formulario", copia_dni: "DNI", autorizacion_imagen: "imagen" };
const textoFaltante = (faltan: TipoDocumento[]) => `Falta ${faltan.map((t) => FALTA_CORTO[t]).join(", ")}`;

export default function AlumnosListPage() {
  // Aviso que deja la inscripción (ej. no se pudo mandar el correo de invitación al padre). Se guarda en el estado del
  // componente y se borra del historial del navegador, así no reaparece al recargar la página.
  const location = useLocation();
  const navigate = useNavigate();
  const [aviso] = useState(() => (location.state as { aviso?: string } | null)?.aviso);
  useEffect(() => {
    if (aviso) navigate({ pathname: location.pathname, search: location.search }, { replace: true, state: null });
  }, [aviso, location.pathname, location.search, navigate]);
  const { data: ciclos } = useCiclos();
  const cicloActivo = ciclos?.find((c) => c.activo);
  // "activo" es un centinela (no un id real): sigue al ciclo marcado como
  // activo en cada momento, mismo patrón que ya usa CursosAdminPage.
  // Filtros en la dirección (los trae puesto el enlace de un aviso y sobreviven a recargar). El buscador no: ahí se
  // escriben nombres y DNI de menores.
  const { leer, escribir } = useFiltrosDeUrl();
  const cicloPedido = leer("ciclo") ?? "activo";
  // Mientras los ciclos cargan se respeta lo pedido; después, un id que no existe vuelve al ciclo activo.
  const filtroCiclo =
    cicloPedido === "activo" || cicloPedido === "todos" || !ciclos || ciclos.some((c) => c.id === cicloPedido) ? cicloPedido : "activo";
  const filtroCuota = elegir(leer("cuota"), FILTROS_CUOTA, "todas");
  const filtroDocumentacion = elegir(leer("documentacion"), FILTROS_DOCUMENTACION, "todos");
  const pagina = Math.max(1, Number(leer("pagina")) || 1);
  // Cambiar cualquier filtro vuelve a la primera página.
  const cambiarFiltros = (cambios: Record<string, string | null>) => escribir({ ...cambios, pagina: null });
  const cicloIdEfectivo = filtroCiclo === "todos" ? undefined : filtroCiclo === "activo" ? cicloActivo?.id : filtroCiclo;

  const { data: alumnos, isLoading, isError } = useAlumnos(cicloIdEfectivo);
  const { data: padres } = usePadres();
  const { data: cursos } = useCursos();
  const { data: cuotas } = useCuotas();
  const { data: faltantes } = useDocumentosFaltantes();
  const faltanDe = (alumnoId: string): TipoDocumento[] => faltantes?.[alumnoId] ?? [];

  const [busqueda, setBusqueda] = useState("");

  const cursosDelCiclo = useMemo(
    () => (cicloIdEfectivo ? (cursos ?? []).filter((c) => c.cicloId === cicloIdEfectivo) : cursos),
    [cursos, cicloIdEfectivo],
  );

  const cursoPedido = leer("curso") ?? "todos";
  const filtroCurso = cursoPedido === "todos" || !cursosDelCiclo || cursosDelCiclo.some((c) => c.id === cursoPedido) ? cursoPedido : "todos";

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
    // Se muestra siempre lo más urgente: vencida > pendiente > pagada.
    const porAlumno = new Map<string, Cuota[]>();
    for (const cuota of cuotas ?? []) porAlumno.set(cuota.alumnoId, [...(porAlumno.get(cuota.alumnoId) ?? []), cuota]);
    const mapa = new Map<string, EstadoCuota>();
    for (const [alumnoId, delAlumno] of porAlumno) {
      const estado = estadoMasUrgente(delAlumno);
      if (estado) mapa.set(alumnoId, estado);
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
      const faltan = faltantes?.[alumno.id] ?? [];
      const matchDocumentacion =
        filtroDocumentacion === "todos" || (filtroDocumentacion === "pendiente" ? faltan.length > 0 : faltan.includes(filtroDocumentacion));
      return matchTexto && matchCuota && matchCurso && matchDocumentacion;
    });
  }, [alumnos, busqueda, filtroCuota, filtroCurso, filtroDocumentacion, faltantes, estadoCuotaPorAlumno]);

  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / POR_PAGINA));
  const paginaActual = Math.min(pagina, totalPaginas);
  const paginados = filtrados.slice((paginaActual - 1) * POR_PAGINA, paginaActual * POR_PAGINA);
  const filasAlumnos = useListaConSalidas(paginados, (a) => a.id, ["alumnos", "cuotas", "documentos"]);


  const paginacion = filtrados.length > 0 && (
    <>
      <span className="text-[12px]" style={{ color: "var(--text-faint)" }}>
        Página {paginaActual} de {totalPaginas}
      </span>
      <div className="flex gap-1">
        <Button variant="outline" size="sm" disabled={paginaActual === 1} onClick={() => escribir({ pagina: paginaActual - 1 === 1 ? null : String(paginaActual - 1) })}>
          ← Anterior
        </Button>
        <Button variant="outline" size="sm" disabled={paginaActual === totalPaginas} onClick={() => escribir({ pagina: String(paginaActual + 1) })}>
          Siguiente →
        </Button>
      </div>
    </>
  );

  return (
    <div className="space-y-4">
      {aviso && (
        <p
          role="status"
          className="px-3.5 py-3 text-[12.5px]"
          style={{ background: "var(--warning-soft)", border: "1px solid var(--warning)", borderRadius: 4 }}
        >
          {aviso}
        </p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <Input
            placeholder="Buscar por nombre, apellido o DNI…"
            value={busqueda}
            onChange={(e) => {
              setBusqueda(e.target.value);
              escribir({ pagina: null });
            }}
            className="w-64"
          />
          <Select
            aria-label="Ciclo"
            value={filtroCiclo}
            onChange={(e) => cambiarFiltros({ ciclo: e.target.value === "activo" ? null : e.target.value, curso: null })}
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
            aria-label="Cuota"
            value={filtroCuota}
            onChange={(e) => cambiarFiltros({ cuota: e.target.value === "todas" ? null : e.target.value })}
            className="w-auto"
          >
            <option value="todas">Todas las cuotas</option>
            <option value="pagada">Al día</option>
            <option value="pendiente">Pendiente</option>
            <option value="vencida">Vencida</option>
          </Select>
          <Select
            aria-label="Curso"
            value={filtroCurso}
            onChange={(e) => cambiarFiltros({ curso: e.target.value === "todos" ? null : e.target.value })}
            className="w-auto"
          >
            <option value="todos">Todos los cursos</option>
            {cursosDelCiclo?.map((curso) => (
              <option key={curso.id} value={curso.id}>
                {curso.nombre}
              </option>
            ))}
          </Select>
          <Select
            aria-label="Documentación"
            value={filtroDocumentacion}
            onChange={(e) => cambiarFiltros({ documentacion: e.target.value === "todos" ? null : e.target.value })}
            className="w-auto"
          >
            <option value="todos">Toda la documentación</option>
            <option value="pendiente">Con documentación pendiente</option>
            <option value="formulario_inscripcion">Falta formulario de inscripción</option>
            <option value="copia_dni">Falta copia de DNI</option>
            <option value="autorizacion_imagen">Falta autorización de imagen</option>
          </Select>
          <span data-cantidad-alumnos className="ml-2 text-[12px]" style={{ color: "var(--text-faint)" }}>
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
          {filasAlumnos.map(({ item: alumno, estado }) => {
            const padre = alumno.padreId ? padresPorId.get(alumno.padreId) : undefined;
            const curso = alumno.cursoId ? cursosPorId.get(alumno.cursoId) : undefined;
            const estadoCuota = estadoCuotaPorAlumno.get(alumno.id);
            return (
              <TableRow key={alumno.id} className={claseDeFila(estado)}>
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
                      {faltanDe(alumno.id).length > 0 && (
                        <div className="text-[11px]" style={{ color: "var(--warning)" }}>
                          {textoFaltante(faltanDe(alumno.id))}
                        </div>
                      )}
                    </div>
                  </div>
                </TableCell>
                <TableCell className="tnum" style={{ color: "var(--text-muted)" }}>{formatDni(alumno.dni)}</TableCell>
                <TableCell>
                  {curso && <span className={`level-pill ${NIVEL_GRUPO[curso.nivel]}`}>{curso.nombre}</span>}
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
        {filasAlumnos.map(({ item: alumno, estado }) => {
          const padre = alumno.padreId ? padresPorId.get(alumno.padreId) : undefined;
          const curso = alumno.cursoId ? cursosPorId.get(alumno.cursoId) : undefined;
          const estadoCuota = estadoCuotaPorAlumno.get(alumno.id);
          return (
            <div key={alumno.id} data-tarjeta-alumno className={`card-hl p-4 ${claseDeFila(estado)}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Avatar name={`${alumno.nombre} ${alumno.apellido}`} size="md" />
                  <div>
                    <p className="text-[14px] font-medium">
                      {alumno.nombre} {alumno.apellido}
                    </p>
                    <p className="tnum text-[11.5px] text-muted-foreground">{formatDni(alumno.dni)}</p>
                    {faltanDe(alumno.id).length > 0 && (
                      <p className="text-[11.5px]" style={{ color: "var(--warning)" }}>
                        {textoFaltante(faltanDe(alumno.id))}
                      </p>
                    )}
                  </div>
                </div>
                {estadoCuota ? (
                  <Badge variant={CUOTA_VARIANT[estadoCuota]}>{CUOTA_LABELS[estadoCuota]}</Badge>
                ) : (
                  <span className="text-[11.5px] text-muted-foreground">Sin cuotas</span>
                )}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-y-1.5 border-t pt-3 text-[12px]" style={{ borderColor: "var(--border-hex)" }}>
                <div>{curso && <span className={`level-pill ${NIVEL_GRUPO[curso.nivel]}`}>{curso.nombre}</span>}</div>
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
