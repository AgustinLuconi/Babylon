import { useMemo, useState } from "react";
import { Mail, RotateCw, X } from "lucide-react";
import { Badge } from "@/core/components/ui/badge";
import { Button } from "@/core/components/ui/button";
import { Input } from "@/core/components/ui/input";
import { Modal } from "@/core/components/ui/modal";
import { Select } from "@/core/components/ui/select";
import { ApiError } from "@/core/lib/apiClient";
import { formatFechaCorta, normalizarTexto } from "@/core/lib/utils";
import { ROL_LABELS, type Rol } from "@/features/auth/types";
import { useCancelarInvitacion } from "../hooks/useCancelarInvitacion";
import { useInvitar } from "../hooks/useInvitar";
import { usePendientes } from "../hooks/usePendientes";
import { useReenviarInvitacion } from "../hooks/useReenviarInvitacion";
import type { EtiquetaAcceso, FilaPendiente, ResultadoEnvio } from "../types";
import { EtiquetaRol } from "./EtiquetaRol";

const ETIQUETAS: Record<EtiquetaAcceso, { texto: string; variante: "neutral" | "warning" | "danger" }> = {
  "sin-cuenta": { texto: "Sin cuenta", variante: "neutral" },
  pendiente: { texto: "Pendiente de aceptación", variante: "warning" },
  vencida: { texto: "Invitación vencida", variante: "danger" },
};
const ORDEN_ROLES: Rol[] = ["admin", "secretario", "profesor", "padre"];

type Accion = "invitar" | "reenviar" | "cancelar";
interface Confirmacion {
  accion: Accion;
  filas: FilaPendiente[];
}

const sePuedeInvitar = (f: FilaPendiente) => f.etiqueta === "sin-cuenta" && !f.sinEmail && !f.emailEnUso;
const sePuedeReenviar = (f: FilaPendiente) => f.etiqueta !== "sin-cuenta";

function motivoParaNoInvitar(f: FilaPendiente): string | null {
  if (f.sinEmail) return "Cargá un email para poder invitar";
  if (f.emailEnUso) return "Email repetido: ya pertenece a otra cuenta";
  return null;
}

function detalle(f: FilaPendiente): string | null {
  if (f.etiqueta === "pendiente" && f.invitacionEnviadaEn && f.invitacionVenceEn) {
    return `enviada el ${formatFechaCorta(f.invitacionEnviadaEn)} · vence el ${formatFechaCorta(f.invitacionVenceEn)}`;
  }
  if (f.etiqueta === "vencida") {
    // Sin enlace guardado: el correo no llegó a enviarse (el enlace se borra cuando el envío falla).
    return f.invitacionVenceEn ? `venció el ${formatFechaCorta(f.invitacionVenceEn)}` : "El correo no llegó a enviarse: reenviá la invitación";
  }
  return motivoParaNoInvitar(f);
}

function textos({ accion, filas }: Confirmacion) {
  const una = filas.length === 1 ? filas[0] : null;
  const quien = una ? `${una.nombre}${una.email ? ` (${una.email})` : ""}` : "";
  if (accion === "invitar") {
    return {
      titulo: "Enviar invitación",
      pregunta: una ? `¿Enviar invitación a ${quien}?` : `¿Enviar ${filas.length} invitaciones?`,
      confirmar: una ? "Enviar invitación" : `Enviar ${filas.length} invitaciones`,
      volver: "Cancelar",
    };
  }
  if (accion === "reenviar") {
    return {
      titulo: "Reenviar invitación",
      pregunta: una ? `¿Reenviar la invitación a ${quien}?` : `¿Reenviar ${filas.length} invitaciones?`,
      confirmar: una ? "Reenviar invitación" : `Reenviar ${filas.length} invitaciones`,
      volver: "Cancelar",
    };
  }
  return {
    titulo: "Cancelar invitación",
    pregunta: `¿Cancelar la invitación de ${quien}? Se borra la cuenta pendiente.`,
    confirmar: "Sí, cancelar invitación",
    volver: "Volver",
  };
}

export function PendientesTab() {
  const { data: filas, isLoading, isError } = usePendientes();
  const invitar = useInvitar();
  const reenviar = useReenviarInvitacion();
  const cancelar = useCancelarInvitacion();
  const [busqueda, setBusqueda] = useState("");
  const [rol, setRol] = useState<Rol | "">("");
  const [etiqueta, setEtiqueta] = useState<EtiquetaAcceso | "">("");
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set());
  const [confirmacion, setConfirmacion] = useState<Confirmacion | null>(null);
  const [resultados, setResultados] = useState<ResultadoEnvio[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const visibles = useMemo(() => {
    const termino = normalizarTexto(busqueda.trim());
    return (filas ?? []).filter(
      (f) =>
        (!rol || f.roles.includes(rol)) &&
        (!etiqueta || f.etiqueta === etiqueta) &&
        (!termino || normalizarTexto(`${f.nombre} ${f.email ?? ""}`).includes(termino)),
    );
  }, [filas, busqueda, rol, etiqueta]);

  const seleccionadas = visibles.filter((f) => seleccion.has(f.clave));
  const paraInvitar = seleccionadas.filter(sePuedeInvitar);
  const paraReenviar = seleccionadas.filter(sePuedeReenviar);
  const todasMarcadas = visibles.length > 0 && visibles.every((f) => seleccion.has(f.clave));
  const ocupado = invitar.isPending || reenviar.isPending || cancelar.isPending;

  const alternar = (clave: string) =>
    setSeleccion((actual) => {
      const nueva = new Set(actual);
      if (nueva.has(clave)) nueva.delete(clave);
      else nueva.add(clave);
      return nueva;
    });
  const alternarTodas = () => setSeleccion(todasMarcadas ? new Set() : new Set(visibles.map((f) => f.clave)));

  const confirmar = async () => {
    if (!confirmacion) return;
    const { accion, filas: objetivo } = confirmacion;
    setError(null);
    try {
      // Los resultados traen el id de la persona (padre, profesor o cuenta): se completa el nombre de quienes no lo traen.
      const conNombres = (resultadosDelEnvio: ResultadoEnvio[]) => {
        const nombres = new Map(objetivo.map((f) => [accion === "invitar" ? (f.padreId ?? f.profesorId)! : f.usuarioId!, f.nombre]));
        return resultadosDelEnvio.map((r) => ({ ...r, nombre: r.nombre || nombres.get(r.id) || "" }));
      };
      if (accion === "invitar") {
        setResultados(
          conNombres(
            await invitar.mutateAsync({
              padreIds: objetivo.filter((f) => f.origen === "padre").map((f) => f.padreId!),
              profesorIds: objetivo.filter((f) => f.origen === "profesor").map((f) => f.profesorId!),
            }),
          ),
        );
      } else if (accion === "reenviar") {
        setResultados(conNombres(await reenviar.mutateAsync(objetivo.map((f) => f.usuarioId!))));
      } else {
        await cancelar.mutateAsync(objetivo[0].usuarioId!);
        setResultados(null);
      }
      setSeleccion(new Set());
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "No se pudo completar la operación");
    } finally {
      setConfirmacion(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          aria-label="Buscar"
          placeholder="Buscar por nombre o email"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="max-w-xs"
        />
        <Select aria-label="Filtrar por rol" value={rol} onChange={(e) => setRol(e.target.value as Rol | "")} className="w-auto">
          <option value="">Todos los roles</option>
          {ORDEN_ROLES.map((r) => (
            <option key={r} value={r}>
              {ROL_LABELS[r]}
            </option>
          ))}
        </Select>
        <Select
          aria-label="Filtrar por estado"
          value={etiqueta}
          onChange={(e) => setEtiqueta(e.target.value as EtiquetaAcceso | "")}
          className="w-auto"
        >
          <option value="">Todos los estados</option>
          {(Object.keys(ETIQUETAS) as EtiquetaAcceso[]).map((e) => (
            <option key={e} value={e}>
              {ETIQUETAS[e].texto}
            </option>
          ))}
        </Select>
        <div className="ml-auto flex flex-wrap gap-2">
          <Button size="sm" disabled={paraInvitar.length === 0 || ocupado} onClick={() => setConfirmacion({ accion: "invitar", filas: paraInvitar })}>
            <Mail size={13} /> Invitar seleccionados ({paraInvitar.length})
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={paraReenviar.length === 0 || ocupado}
            onClick={() => setConfirmacion({ accion: "reenviar", filas: paraReenviar })}
          >
            <RotateCw size={13} /> Reenviar seleccionados ({paraReenviar.length})
          </Button>
        </div>
      </div>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {resultados && <Resumen resultados={resultados} onCerrar={() => setResultados(null)} />}

      {/* `relative`: el texto oculto de la columna de acciones (sr-only) es absoluto y, sin esto, agranda la página. */}
      <div className="card-hl relative overflow-x-auto">
        <table className="tbl">
          <thead>
            <tr>
              <th className="w-8">
                <input
                  type="checkbox"
                  aria-label="Marcar todas las visibles"
                  checked={todasMarcadas}
                  onChange={alternarTodas}
                  disabled={visibles.length === 0}
                />
              </th>
              <th>Persona</th>
              <th>Email</th>
              <th>Rol</th>
              <th>Estado</th>
              <th>
                <span className="sr-only">Acciones</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={6} className="h-20 text-center text-muted-foreground">
                  Cargando…
                </td>
              </tr>
            )}
            {isError && (
              <tr>
                <td colSpan={6} role="alert" className="h-20 text-center text-destructive">
                  No se pudo cargar la lista.
                </td>
              </tr>
            )}
            {filas && visibles.length === 0 && (
              <tr>
                <td colSpan={6} className="h-20 text-center text-muted-foreground">
                  No hay personas pendientes con estos filtros.
                </td>
              </tr>
            )}
            {visibles.map((f) => {
              const textoDetalle = detalle(f);
              return (
                <tr key={f.clave}>
                  <td>
                    <input type="checkbox" aria-label={`Seleccionar a ${f.nombre}`} checked={seleccion.has(f.clave)} onChange={() => alternar(f.clave)} />
                  </td>
                  <td className="font-medium">{f.nombre}</td>
                  <td className="font-mono text-[12px]" style={{ color: "var(--text-muted)" }}>
                    {f.email ?? "—"}
                  </td>
                  <td>
                    <div className="flex flex-wrap gap-1">
                      {f.roles.map((r) => (
                        <EtiquetaRol key={r} rol={r} />
                      ))}
                    </div>
                  </td>
                  <td>
                    <Badge variant={ETIQUETAS[f.etiqueta].variante}>{ETIQUETAS[f.etiqueta].texto}</Badge>
                    {textoDetalle && (
                      <p className="mt-1 text-[11.5px]" style={{ color: "var(--text-muted)" }}>
                        {textoDetalle}
                      </p>
                    )}
                  </td>
                  <td className="whitespace-nowrap text-right">
                    {f.etiqueta === "sin-cuenta" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={!sePuedeInvitar(f) || ocupado}
                        title={motivoParaNoInvitar(f) ?? undefined}
                        aria-label={`Invitar a ${f.nombre}`}
                        onClick={() => setConfirmacion({ accion: "invitar", filas: [f] })}
                      >
                        Invitar
                      </Button>
                    ) : (
                      <div className="flex justify-end gap-1.5">
                        <Button
                          size="sm"
                          variant={f.etiqueta === "vencida" ? "default" : "outline"}
                          data-resaltado={f.etiqueta === "vencida" ? "true" : undefined}
                          disabled={ocupado}
                          aria-label={`Reenviar la invitación a ${f.nombre}`}
                          onClick={() => setConfirmacion({ accion: "reenviar", filas: [f] })}
                        >
                          Reenviar
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={ocupado}
                          aria-label={`Cancelar la invitación de ${f.nombre}`}
                          onClick={() => setConfirmacion({ accion: "cancelar", filas: [f] })}
                        >
                          Cancelar
                        </Button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {confirmacion && (
        <ModalConfirmacion confirmacion={confirmacion} ocupado={ocupado} onConfirmar={confirmar} onCerrar={() => setConfirmacion(null)} />
      )}
    </div>
  );
}

function Resumen({ resultados, onCerrar }: { resultados: ResultadoEnvio[]; onCerrar: () => void }) {
  const enviadas = resultados.filter((r) => r.resultado === "enviada").length;
  const fallidas = resultados.filter((r) => r.resultado === "no-enviada");
  return (
    <div role="status" className="card-hl px-4 py-3 text-[13px]">
      <div className="flex items-start justify-between gap-3">
        <p className="font-medium">
          {enviadas} {enviadas === 1 ? "enviada" : "enviadas"}
          {fallidas.length > 0 && ` · ${fallidas.length} ${fallidas.length === 1 ? "no se pudo enviar" : "no se pudieron enviar"}`}
        </p>
        <button type="button" aria-label="Cerrar el resumen" onClick={onCerrar} className="rounded p-0.5 text-muted-foreground hover:bg-accent">
          <X size={14} />
        </button>
      </div>
      {fallidas.length > 0 && (
        <ul className="mt-2 space-y-0.5 text-[12.5px]" style={{ color: "var(--text-muted)" }}>
          {fallidas.map((r) => (
            <li key={r.id}>
              {r.nombre || r.id}: {r.motivo}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ModalConfirmacion({
  confirmacion,
  ocupado,
  onConfirmar,
  onCerrar,
}: {
  confirmacion: Confirmacion;
  ocupado: boolean;
  onConfirmar: () => void;
  onCerrar: () => void;
}) {
  const t = textos(confirmacion);
  return (
    <Modal
      title={t.titulo}
      onClose={onCerrar}
      footer={
        <>
          <Button variant="outline" className="flex-1" onClick={onCerrar}>
            {t.volver}
          </Button>
          <Button className="flex-1" disabled={ocupado} onClick={onConfirmar}>
            {ocupado ? "Procesando…" : t.confirmar}
          </Button>
        </>
      }
    >
      <p className="text-[13.5px]">{t.pregunta}</p>
      {confirmacion.filas.length > 1 && (
        <ul className="max-h-48 space-y-0.5 overflow-y-auto text-[12.5px]" style={{ color: "var(--text-muted)" }}>
          {confirmacion.filas.map((f) => (
            <li key={f.clave}>
              {f.nombre}
              {f.email ? ` · ${f.email}` : ""}
            </li>
          ))}
        </ul>
      )}
      {confirmacion.accion !== "cancelar" && (
        <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>
          Cada persona recibe un correo con un enlace que vale 7 días.
        </p>
      )}
    </Modal>
  );
}
