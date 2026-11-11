import { useEffect, useMemo, useState } from "react";
import { Pencil, UserPlus } from "lucide-react";
import { claseDeFila, useListaConSalidas } from "@/core/hooks/useListaConSalidas";
import { elegir, useFiltrosDeUrl } from "@/core/hooks/useFiltrosDeUrl";
import { Avatar } from "@/core/components/ui/avatar";
import { Button } from "@/core/components/ui/button";
import { Interruptor } from "@/core/components/ui/interruptor";
import { ApiError } from "@/core/lib/apiClient";
import { formatFecha } from "@/core/lib/utils";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { CrearCuentaModal } from "../components/CrearCuentaModal";
import { EditarCuentaModal } from "../components/EditarCuentaModal";
import { EtiquetaRol } from "../components/EtiquetaRol";
import { SinCuentaTab } from "../components/SinCuentaTab";
import { useCambiarEstadoUsuario } from "../hooks/useCambiarEstadoUsuario";
import { useSinCuenta } from "../hooks/useSinCuenta";
import { useUsuarios } from "../hooks/useUsuarios";
import type { CuentaUsuario, FilaSinCuenta } from "../types";

const PESTANAS = ["cuentas", "sin-cuenta"] as const;
type IdPestana = (typeof PESTANAS)[number];

// Quién entra al sistema. Solo el administrador crea cuentas, asigna contraseñas y cambia roles: "Sin cuenta" lista a los
// responsables y profesores que todavía no tienen acceso y "Crear usuario" sirve para cualquier rol.
export default function UsuariosPage() {
  const { usuario: sesion } = useAuth();
  const { data: cuentas, isLoading } = useUsuarios();
  const { data: sinCuenta } = useSinCuenta();
  const filasCuentas = useListaConSalidas(cuentas ?? [], (c) => c.id, ["usuarios"]);
  const cambiarEstado = useCambiarEstadoUsuario();
  const { leer, escribir } = useFiltrosDeUrl();
  const pestana: IdPestana = elegir(leer("pestana"), PESTANAS, "cuentas");
  const setPestana = (id: IdPestana) => escribir({ pestana: id === "cuentas" ? null : id });

  // Un solo modal a la vez: crear (con o sin ficha preelegida) o editar una cuenta (por id, así llega actualizada).
  const [crear, setCrear] = useState<{ ficha?: FilaSinCuenta } | null>(null);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const editando = cuentas?.find((c) => c.id === editandoId);
  const [toast, setToast] = useState("");

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 3600);
    return () => clearTimeout(t);
  }, [toast]);

  const activas = useMemo(() => (cuentas ?? []).filter((c) => c.estado === "activo").length, [cuentas]);
  const alternarEstado = (cuenta: CuentaUsuario) => cambiarEstado.mutate({ id: cuenta.id, estado: cuenta.estado === "activo" ? "inactivo" : "activo" });
  const esCuentaPropia = (cuenta: CuentaUsuario) => cuenta.id === sesion?.id;

  // Navegación de las pestañas con el teclado (patrón ARIA de "tabs"): flechas, Inicio y Fin; mueve el foco y la selección.
  const moverPestana = (e: React.KeyboardEvent) => {
    const actual = PESTANAS.indexOf(pestana);
    const destino =
      e.key === "ArrowRight" ? (actual + 1) % PESTANAS.length
      : e.key === "ArrowLeft" ? (actual - 1 + PESTANAS.length) % PESTANAS.length
      : e.key === "Home" ? 0
      : e.key === "End" ? PESTANAS.length - 1
      : null;
    if (destino === null) return;
    e.preventDefault();
    setPestana(PESTANAS[destino]);
    document.getElementById(`pestana-${PESTANAS[destino]}`)?.focus();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b" style={{ borderColor: "var(--border-hex)" }}>
        <div role="tablist" aria-label="Usuarios" className="flex gap-1" onKeyDown={moverPestana}>
          {PESTANAS.map((id) => (
            <button
              key={id}
              id={`pestana-${id}`}
              type="button"
              role="tab"
              aria-selected={pestana === id}
              aria-controls="panel-usuarios"
              // Solo la pestaña activa entra en el orden del teclado; entre pestañas se mueve con las flechas.
              tabIndex={pestana === id ? 0 : -1}
              onClick={() => setPestana(id)}
              className="-mb-px px-3.5 py-2 text-[13px] font-medium transition-colors"
              style={{ borderBottom: `2px solid ${pestana === id ? "var(--brand)" : "transparent"}`, color: pestana === id ? "var(--brand)" : "var(--text-muted)" }}
            >
              {id === "cuentas" ? "Cuentas" : `Sin cuenta${sinCuenta && sinCuenta.length > 0 ? ` (${sinCuenta.length})` : ""}`}
            </button>
          ))}
        </div>
        <Button className="mb-2" data-crear-usuario onClick={() => setCrear({})}>
          <UserPlus size={14} /> Crear usuario
        </Button>
      </div>

      <div role="tabpanel" id="panel-usuarios" aria-labelledby={`pestana-${pestana}`} className="space-y-4">
        {pestana === "sin-cuenta" ? (
          <SinCuentaTab onCrearCuenta={(ficha) => setCrear({ ficha })} />
        ) : (
          <>
            <p className="text-[13px]" style={{ color: "var(--text-muted)" }}>
              <span className="font-medium" style={{ color: "var(--text)" }}>
                {activas}
              </span>{" "}
              usuarios activos
              <span style={{ color: "var(--text-faint)" }}> · {cuentas?.length ?? 0} en total</span>
            </p>

            {cambiarEstado.isError && (
              <p className="text-sm text-destructive">{cambiarEstado.error instanceof ApiError ? cambiarEstado.error.message : "No se pudo cambiar el estado"}</p>
            )}

            <div className="card-hl hidden overflow-x-auto md:block">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Usuario</th>
                    <th>Email</th>
                    <th>Rol</th>
                    <th>Estado</th>
                    <th>Creado</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {isLoading && (
                    <tr>
                      <td colSpan={6} className="h-20 text-center text-muted-foreground">
                        Cargando usuarios…
                      </td>
                    </tr>
                  )}
                  {filasCuentas.map(({ item: cuenta, estado }) => (
                    <tr key={cuenta.id} data-cuenta={cuenta.id} className={claseDeFila(estado)} style={{ opacity: cuenta.estado === "inactivo" ? 0.5 : 1 }}>
                      <td>
                        <div className="flex items-center gap-2.5">
                          <Avatar name={cuenta.nombre} size="xs" />
                          <span className="font-medium">{cuenta.nombre}</span>
                        </div>
                      </td>
                      <td className="font-mono text-[12px]" style={{ color: "var(--text-muted)" }}>
                        {cuenta.email}
                      </td>
                      <td>
                        <div className="flex flex-wrap gap-1">
                          {cuenta.roles.map((r) => (
                            <EtiquetaRol key={r} rol={r} />
                          ))}
                        </div>
                      </td>
                      <td>
                        <Interruptor
                          activo={cuenta.estado === "activo"}
                          onClick={() => alternarEstado(cuenta)}
                          deshabilitado={cambiarEstado.isPending || esCuentaPropia(cuenta)}
                          titulo={esCuentaPropia(cuenta) ? "No podés desactivar tu propia cuenta" : undefined}
                        />
                      </td>
                      <td className="tnum" style={{ color: "var(--text-faint)" }}>
                        {formatFecha(cuenta.fechaCreacion)}
                      </td>
                      <td className="text-right">
                        <button type="button" data-editar-cuenta={cuenta.id} aria-label={`Editar la cuenta de ${cuenta.nombre}`} title="Editar" className="rounded p-1.5 text-muted-foreground hover:bg-accent" onClick={() => setEditandoId(cuenta.id)}>
                          <Pencil size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile */}
            <div className="space-y-2.5 md:hidden">
              {filasCuentas.map(({ item: cuenta, estado }) => (
                <div key={cuenta.id} className={`card-hl p-4 ${claseDeFila(estado)}`} style={{ opacity: cuenta.estado === "inactivo" ? 0.5 : 1 }}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <Avatar name={cuenta.nombre} size="md" />
                      <div className="min-w-0">
                        <p className="truncate text-[13.5px] font-medium">{cuenta.nombre}</p>
                        <p className="truncate font-mono text-[11.5px]" style={{ color: "var(--text-faint)" }}>
                          {cuenta.email}
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                      {cuenta.roles.map((r) => (
                        <EtiquetaRol key={r} rol={r} compacta />
                      ))}
                      <div className="flex items-center gap-2">
                        <button type="button" aria-label={`Editar la cuenta de ${cuenta.nombre}`} className="rounded p-1.5 text-muted-foreground hover:bg-accent" onClick={() => setEditandoId(cuenta.id)}>
                          <Pencil size={14} />
                        </button>
                        <Interruptor activo={cuenta.estado === "activo"} onClick={() => alternarEstado(cuenta)} deshabilitado={cambiarEstado.isPending || esCuentaPropia(cuenta)} />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {crear && (
        <CrearCuentaModal
          ficha={crear.ficha}
          onCerrar={() => setCrear(null)}
          onCreada={(mensaje) => {
            setCrear(null);
            setToast(mensaje);
          }}
        />
      )}
      {editando && (
        <EditarCuentaModal
          cuenta={editando}
          onCerrar={() => setEditandoId(null)}
          onGuardada={(mensaje) => {
            setEditandoId(null);
            setToast(mensaje);
          }}
        />
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 flex max-w-[360px] -translate-x-1/2 items-center gap-2 rounded px-4 py-2.5 text-center text-[12.5px] font-medium" style={{ background: "var(--text)", color: "var(--bg)" }}>
          <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: "var(--brand-dot)" }} />
          {toast}
        </div>
      )}
    </div>
  );
}
