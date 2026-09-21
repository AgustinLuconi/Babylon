import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AlertTriangle, UserPlus } from "lucide-react";
import { Avatar } from "@/core/components/ui/avatar";
import { Button } from "@/core/components/ui/button";
import { Input } from "@/core/components/ui/input";
import { Modal } from "@/core/components/ui/modal";
import { Select } from "@/core/components/ui/select";
import { ApiError } from "@/core/lib/apiClient";
import { formatFecha } from "@/core/lib/utils";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { ROL_LABELS, type Rol } from "@/features/auth/types";
import { useCrearPadre } from "@/features/padres/hooks/useCrearPadre";
import { VINCULO_LABELS, type VinculoPadre } from "@/features/padres/types";
import { useCrearProfesor } from "@/features/profesores/hooks/useCrearProfesor";
import { useCrearSecretario } from "@/features/secretarios/hooks/useCrearSecretario";
import { useCambiarEstadoUsuario } from "../hooks/useCambiarEstadoUsuario";
import { useCrearAdministrador } from "../hooks/useCrearAdministrador";
import { useUsuarios } from "../hooks/useUsuarios";
import type { CuentaUsuario } from "../types";

// Colores de la etiqueta de rol, calcados de ROLE_LABELS del prototipo.
const ESTILO_ROL: Record<Rol, { color: string; bg: string; dot: string }> = {
  admin: { color: "#09090B", bg: "#F4F4F5", dot: "#0F3D2E" },
  secretario: { color: "#09090B", bg: "#F4F4F5", dot: "#71717A" },
  profesor: { color: "#0F3D2E", bg: "#F0F4F2", dot: "#1B7A4F" },
  padre: { color: "#52525B", bg: "#FAFAFA", dot: "#A1A1AA" },
};

const DESCRIPCION_ROL: Record<Rol, string> = {
  admin: "Acceso total al sistema, incluyendo configuración y datos sensibles.",
  secretario: "Puede gestionar legajos y registrar pagos. Sin acceso a reportes ni configuración.",
  profesor: "Accede solo a sus cursos asignados. No ve información de pagos.",
  padre: "Solo puede ver la información de sus hijos vinculados.",
};

const ORDEN_ROLES: Rol[] = ["admin", "secretario", "profesor", "padre"];

// Un único formulario para los 4 roles: cada rol pide un subconjunto distinto
// de campos (Padre y Profesor tienen ficha propia, Admin y Secretario son
// solo una cuenta), así que la validación de los campos extra va en el
// `superRefine` según el rol elegido.
const cuentaSchema = z
  .object({
    rol: z.enum(["admin", "secretario", "profesor", "padre"]),
    nombre: z.string().min(1, "El nombre es requerido"),
    apellido: z.string().optional(),
    dni: z.string().optional(),
    telefono: z.string().optional(),
    vinculo: z.enum(["padre", "madre", "tutor"]).optional(),
    email: z.string().email("Email inválido"),
    password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
  })
  .superRefine((datos, ctx) => {
    if (datos.rol === "profesor" || datos.rol === "padre") {
      if (!datos.apellido?.trim()) ctx.addIssue({ code: "custom", path: ["apellido"], message: "El apellido es requerido" });
      if (!datos.dni?.trim()) ctx.addIssue({ code: "custom", path: ["dni"], message: "El DNI es requerido" });
    }
    if (datos.rol === "padre" && !datos.vinculo) {
      ctx.addIssue({ code: "custom", path: ["vinculo"], message: "El vínculo es requerido" });
    }
  });
type CuentaForm = z.infer<typeof cuentaSchema>;

const VALORES_INICIALES: CuentaForm = {
  rol: "profesor",
  nombre: "",
  apellido: "",
  dni: "",
  telefono: "",
  vinculo: undefined,
  email: "",
  password: "",
};

function generarPassword(): string {
  const caracteres = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  const azar = crypto.getRandomValues(new Uint32Array(12));
  return Array.from(azar, (n) => caracteres[n % caracteres.length]).join("");
}

function EtiquetaRol({ rol, compacta = false }: { rol: Rol; compacta?: boolean }) {
  const estilo = ESTILO_ROL[rol];
  return (
    <span
      className={`inline-flex flex-shrink-0 items-center font-medium ${
        compacta ? "gap-1 px-2 py-0.5 text-[11px]" : "gap-1.5 px-2 py-0.5 text-[11.5px]"
      }`}
      style={{ background: estilo.bg, color: estilo.color, borderRadius: 2 }}
    >
      <span className={`rounded-full ${compacta ? "h-1 w-1" : "h-1.5 w-1.5"}`} style={{ background: estilo.dot }} />
      {ROL_LABELS[rol]}
    </span>
  );
}

function Interruptor({
  activo,
  onClick,
  deshabilitado,
  titulo,
}: {
  activo: boolean;
  onClick: () => void;
  deshabilitado?: boolean;
  titulo?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={activo}
      title={titulo}
      disabled={deshabilitado}
      onClick={onClick}
      className="relative inline-flex items-center disabled:cursor-not-allowed disabled:opacity-60"
      style={{
        width: 30,
        height: 18,
        background: activo ? "var(--brand)" : "var(--border-strong)",
        borderRadius: 999,
        transition: "background 150ms ease",
      }}
    >
      <span
        className="absolute"
        style={{
          width: 12,
          height: 12,
          background: "#fff",
          borderRadius: 999,
          left: activo ? 15 : 3,
          transition: "left 150ms ease",
        }}
      />
    </button>
  );
}

export default function UsuariosPage() {
  const { usuario: sesion } = useAuth();
  const { data: cuentas, isLoading } = useUsuarios();
  const cambiarEstado = useCambiarEstadoUsuario();
  const crearAdministrador = useCrearAdministrador();
  const crearSecretario = useCrearSecretario();
  const crearProfesor = useCrearProfesor();
  const crearPadre = useCrearPadre();

  const [mostrarModal, setMostrarModal] = useState(false);
  const [toast, setToast] = useState("");

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    clearErrors,
    formState: { errors },
  } = useForm<CuentaForm>({ resolver: zodResolver(cuentaSchema), defaultValues: VALORES_INICIALES });

  const rol = watch("rol");
  const password = watch("password");

  const activas = useMemo(() => (cuentas ?? []).filter((c) => c.estado === "activo").length, [cuentas]);

  const abrirModal = () => {
    reset(VALORES_INICIALES);
    setMostrarModal(true);
  };

  const elegirRol = (nuevo: Rol) => {
    setValue("rol", nuevo);
    clearErrors();
  };

  const creacion = [crearAdministrador, crearSecretario, crearProfesor, crearPadre];
  const guardando = creacion.some((m) => m.isPending);
  const errorGuardado = creacion.map((m) => m.error).find(Boolean);

  const onSubmit = handleSubmit(async (d) => {
    const apellido = d.apellido?.trim() ?? "";
    const dni = d.dni?.trim() ?? "";
    const telefono = d.telefono?.trim() || undefined;

    if (d.rol === "admin") {
      await crearAdministrador.mutateAsync({ nombre: d.nombre, email: d.email, password: d.password });
    } else if (d.rol === "secretario") {
      await crearSecretario.mutateAsync({ nombre: d.nombre, email: d.email, password: d.password });
    } else if (d.rol === "profesor") {
      await crearProfesor.mutateAsync({ nombre: d.nombre, apellido, dni, telefono, email: d.email, password: d.password });
    } else {
      await crearPadre.mutateAsync({
        nombre: d.nombre,
        apellido,
        dni,
        telefono,
        email: d.email,
        password: d.password,
        vinculo: d.vinculo as VinculoPadre,
      });
    }
    setMostrarModal(false);
    setToast(`Usuario ${d.email} creado`);
  });

  const alternarEstado = (cuenta: CuentaUsuario) => {
    cambiarEstado.mutate({ id: cuenta.id, estado: cuenta.estado === "activo" ? "inactivo" : "activo" });
  };

  const esCuentaPropia = (cuenta: CuentaUsuario) => cuenta.id === sesion?.id;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-[13px]" style={{ color: "var(--text-muted)" }}>
          <span className="font-medium" style={{ color: "var(--text)" }}>
            {activas}
          </span>{" "}
          usuarios activos
          <span style={{ color: "var(--text-faint)" }}> · {cuentas?.length ?? 0} en total</span>
        </p>
        <Button onClick={abrirModal}>
          <UserPlus size={14} /> Crear usuario
        </Button>
      </div>

      {cambiarEstado.isError && (
        <p className="text-sm text-destructive">
          {cambiarEstado.error instanceof ApiError ? cambiarEstado.error.message : "No se pudo cambiar el estado"}
        </p>
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
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={5} className="h-20 text-center text-muted-foreground">
                  Cargando usuarios…
                </td>
              </tr>
            )}
            {(cuentas ?? []).map((cuenta) => (
              <tr key={cuenta.id} style={{ opacity: cuenta.estado === "inactivo" ? 0.5 : 1 }}>
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
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile */}
      <div className="space-y-2.5 md:hidden">
        {(cuentas ?? []).map((cuenta) => (
          <div key={cuenta.id} className="card-hl p-4" style={{ opacity: cuenta.estado === "inactivo" ? 0.5 : 1 }}>
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
              <div className="flex flex-shrink-0 flex-col items-end gap-1.5">
                {cuenta.roles.map((r) => (
                  <EtiquetaRol key={r} rol={r} compacta />
                ))}
                <Interruptor
                  activo={cuenta.estado === "activo"}
                  onClick={() => alternarEstado(cuenta)}
                  deshabilitado={cambiarEstado.isPending || esCuentaPropia(cuenta)}
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      {mostrarModal && (
        <Modal
          title="Crear usuario"
          onClose={() => setMostrarModal(false)}
          footer={
            <>
              <Button variant="outline" className="flex-1" onClick={() => setMostrarModal(false)}>
                Cancelar
              </Button>
              <Button className="flex-1" disabled={guardando} onClick={onSubmit}>
                {guardando ? "Creando…" : "Crear usuario"}
              </Button>
            </>
          }
        >
          <form className="space-y-4" noValidate onSubmit={onSubmit}>
            <div>
              <label className="label">Rol</label>
              <div className="space-y-1.5">
                {ORDEN_ROLES.map((valor) => {
                  const seleccionado = rol === valor;
                  return (
                    <button
                      key={valor}
                      type="button"
                      onClick={() => elegirRol(valor)}
                      className="w-full px-3.5 py-3 text-left transition-all"
                      style={{
                        border: `1px solid ${seleccionado ? "var(--brand)" : "var(--border-hex)"}`,
                        background: seleccionado ? "var(--brand-soft)" : "var(--bg)",
                        borderRadius: 4,
                      }}
                    >
                      <div className="flex items-center gap-2.5">
                        <span
                          className="flex flex-shrink-0 items-center justify-center"
                          style={{
                            width: 14,
                            height: 14,
                            border: `1px solid ${seleccionado ? "var(--brand)" : "var(--border-strong)"}`,
                            background: seleccionado ? "var(--brand)" : "var(--bg)",
                            borderRadius: 999,
                          }}
                        >
                          {seleccionado && <span style={{ width: 4, height: 4, background: "#fff", borderRadius: 999 }} />}
                        </span>
                        <span
                          className="text-[13px] font-medium"
                          style={{ color: seleccionado ? "var(--brand)" : "var(--text)" }}
                        >
                          {ROL_LABELS[valor]}
                        </span>
                      </div>
                      <p
                        className="mt-1.5 text-[11.5px]"
                        style={{
                          marginLeft: 22,
                          color: seleccionado ? "var(--brand)" : "var(--text-muted)",
                          opacity: seleccionado ? 0.85 : 1,
                        }}
                      >
                        {DESCRIPCION_ROL[valor]}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            {rol === "admin" && (
              <div
                className="flex items-start gap-2 px-3.5 py-3"
                style={{ background: "var(--danger-soft)", border: "1px solid var(--danger)", borderRadius: 4 }}
              >
                <AlertTriangle size={14} className="mt-px flex-shrink-0" style={{ color: "var(--danger)" }} />
                <p className="text-[12px]" style={{ color: "var(--danger)" }}>
                  Acceso total al sistema. Asignar únicamente a personal de máxima confianza.
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className={`space-y-1.5 ${rol === "admin" || rol === "secretario" ? "col-span-2" : ""}`}>
                <label className="label">{rol === "admin" || rol === "secretario" ? "Nombre completo" : "Nombre"}</label>
                <Input {...register("nombre")} />
                {errors.nombre && <p className="text-sm text-destructive">{errors.nombre.message}</p>}
              </div>
              {(rol === "profesor" || rol === "padre") && (
                <>
                  <div className="space-y-1.5">
                    <label className="label">Apellido</label>
                    <Input {...register("apellido")} />
                    {errors.apellido && <p className="text-sm text-destructive">{errors.apellido.message}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <label className="label">DNI</label>
                    <Input {...register("dni")} className="font-mono" />
                    {errors.dni && <p className="text-sm text-destructive">{errors.dni.message}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <label className="label">Teléfono</label>
                    <Input {...register("telefono")} />
                  </div>
                </>
              )}
              {rol === "padre" && (
                <div className="col-span-2 space-y-1.5">
                  <label className="label">Vínculo</label>
                  <Select {...register("vinculo")} defaultValue="">
                    <option value="" disabled>
                      Elegir…
                    </option>
                    {(Object.entries(VINCULO_LABELS) as [VinculoPadre, string][]).map(([valor, etiqueta]) => (
                      <option key={valor} value={valor}>
                        {etiqueta}
                      </option>
                    ))}
                  </Select>
                  {errors.vinculo && <p className="text-sm text-destructive">{errors.vinculo.message}</p>}
                </div>
              )}
              <div className="col-span-2 space-y-1.5">
                <label className="label">Email (usuario de acceso)</label>
                <Input type="email" {...register("email")} className="font-mono" />
                {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
              </div>
              <div className="col-span-2 space-y-1.5">
                <label className="label">Contraseña de acceso</label>
                <div className="flex gap-2">
                  <Input
                    {...register("password")}
                    type="text"
                    autoComplete="off"
                    placeholder="Ingresá o generá"
                    className="font-mono"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-shrink-0"
                    onClick={() => setValue("password", generarPassword(), { shouldValidate: true })}
                  >
                    Generar
                  </Button>
                </div>
                {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}
                {password && (
                  <p className="text-[11.5px] text-muted-foreground">
                    Anotala ahora: después no se puede volver a ver.
                  </p>
                )}
              </div>
            </div>

            {errorGuardado && (
              <p className="text-sm text-destructive">
                {errorGuardado instanceof ApiError ? errorGuardado.message : "No se pudo crear el usuario"}
              </p>
            )}
          </form>
        </Modal>
      )}

      {toast && (
        <div
          className="fixed bottom-6 left-1/2 z-50 flex max-w-[320px] -translate-x-1/2 items-center gap-2 rounded px-4 py-2.5 text-center text-[12.5px] font-medium"
          style={{ background: "var(--text)", color: "var(--bg)" }}
        >
          <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full" style={{ background: "var(--brand-dot)" }} />
          {toast}
        </div>
      )}
    </div>
  );
}
