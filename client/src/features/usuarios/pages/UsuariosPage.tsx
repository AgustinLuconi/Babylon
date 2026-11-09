import { useEffect, useMemo, useState } from "react";
import { claseDeFila, useListaConSalidas } from "@/core/hooks/useListaConSalidas";
import { useSinGuardar } from "@/core/sinGuardar/sinGuardar";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { passwordNueva } from "@/core/lib/validacion";
import { AlertTriangle, UserPlus } from "lucide-react";
import { Avatar } from "@/core/components/ui/avatar";
import { Button } from "@/core/components/ui/button";
import { Input } from "@/core/components/ui/input";
import { Modal } from "@/core/components/ui/modal";
import { ApiError } from "@/core/lib/apiClient";
import { formatFecha } from "@/core/lib/utils";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { ROL_LABELS, type Rol } from "@/features/auth/types";
import { useCrearPadre } from "@/features/padres/hooks/useCrearPadre";
import { normalizarCelular, normalizarDni, normalizarEmail } from "@/core/lib/validacion";
import { useCrearProfesor } from "@/features/profesores/hooks/useCrearProfesor";
import { useCrearSecretario } from "@/features/secretarios/hooks/useCrearSecretario";
import { mensajeDeAlta } from "../alta";
import { EtiquetaRol } from "../components/EtiquetaRol";
import { ModoDeAcceso } from "../components/ModoDeAcceso";
import { PendientesTab } from "../components/PendientesTab";
import { useCambiarEstadoUsuario } from "../hooks/useCambiarEstadoUsuario";
import { useCrearAdministrador } from "../hooks/useCrearAdministrador";
import { useUsuarios } from "../hooks/useUsuarios";
import type { CuentaUsuario, EstadoInvitacion } from "../types";
import { Interruptor } from "@/core/components/ui/interruptor";

const DESCRIPCION_ROL: Record<Rol, string> = {
  admin: "Acceso total al sistema, incluyendo configuración y datos sensibles.",
  secretario: "Puede gestionar legajos y registrar pagos. Sin acceso a reportes ni configuración.",
  profesor: "Accede solo a sus cursos asignados. No ve información de pagos.",
  padre: "Ve la información de sus hijos o de su propia cursada. Solo lo suyo.",
};

const ORDEN_ROLES: Rol[] = ["admin", "secretario", "profesor", "padre"];

// Un único formulario para los 4 roles: cada rol pide un subconjunto distinto
// de campos (Padre y Profesor tienen ficha propia, Admin y Secretario son
// solo una cuenta), así que la validación de los campos extra va en el
// `superRefine` según el rol elegido.
const cuentaSchema = z
  .object({
    rol: z.enum(["admin", "secretario", "profesor", "padre"]),
    nombre: z.string().trim().min(1, "El nombre es requerido").max(60, "El nombre admite hasta 60 caracteres"),
    apellido: z.string().optional(),
    dni: z.string().optional(),
    telefono: z.string().optional(),
    // El responsable puede crearse sin email (queda sin cuenta); para los demás roles es obligatorio.
    email: z.string(),
    password: z.string().optional(),
    modo: z.enum(["invitacion", "contrasena"]),
  })
  .superRefine((datos, ctx) => {
    const error = (path: string, message: string) => ctx.addIssue({ code: "custom", path: [path], message });
    const email = datos.email.trim();
    if (datos.rol === "profesor" || datos.rol === "padre") {
      const apellido = datos.apellido?.trim() ?? "";
      if (!apellido) error("apellido", "El apellido es requerido");
      else if (apellido.length > 60) error("apellido", "El apellido admite hasta 60 caracteres");
    }
    const dni = datos.dni?.trim() ?? "";
    if (datos.rol === "profesor" && !dni) error("dni", "El DNI es requerido");
    else if (dni && normalizarDni(dni) === null) error("dni", "El DNI no es válido: tiene que tener 7 u 8 números");
    const telefono = datos.telefono?.trim() ?? "";
    if (datos.rol === "padre" && !telefono) error("telefono", "El celular es requerido");
    else if (telefono && normalizarCelular(telefono) === null) {
      error("telefono", "El celular no es válido: escribilo con el código de área, por ejemplo 351 555-1234");
    }
    if (!email) {
      if (datos.rol !== "padre") error("email", "El email es requerido");
    } else if (!z.email().safeParse(normalizarEmail(email)).success) {
      error("email", "Email inválido");
    }
    if (datos.modo === "contrasena" && email) {
      const resultado = passwordNueva.safeParse(datos.password ?? "");
      if (!resultado.success) error("password", resultado.error.issues[0].message);
    }
  });
type CuentaForm = z.infer<typeof cuentaSchema>;

const VALORES_INICIALES: CuentaForm = {
  rol: "profesor",
  nombre: "",
  apellido: "",
  dni: "",
  telefono: "",
  email: "",
  password: "",
  modo: "invitacion",
};

function generarPassword(): string {
  const caracteres = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  const azar = crypto.getRandomValues(new Uint32Array(12));
  return Array.from(azar, (n) => caracteres[n % caracteres.length]).join("");
}

const PESTANAS = [
  ["cuentas", "Cuentas"],
  ["pendientes", "Pendientes"],
] as const;
type IdPestana = (typeof PESTANAS)[number][0];

export default function UsuariosPage() {
  const { usuario: sesion } = useAuth();
  const { data: cuentas, isLoading } = useUsuarios();
  const filasCuentas = useListaConSalidas(cuentas ?? [], (c) => c.id, ["usuarios"]);
  const cambiarEstado = useCambiarEstadoUsuario();
  const crearAdministrador = useCrearAdministrador();
  const crearSecretario = useCrearSecretario();
  const crearProfesor = useCrearProfesor();
  const crearPadre = useCrearPadre();

  const [mostrarModal, setMostrarModal] = useState(false);
  const [toast, setToast] = useState("");
  const [pestana, setPestana] = useState<IdPestana>("cuentas");

  // Navegación de las pestañas con el teclado (patrón ARIA de "tabs"): flechas, Inicio y Fin; mueve el foco y la selección.
  const moverPestana = (e: React.KeyboardEvent) => {
    const actual = PESTANAS.findIndex(([id]) => id === pestana);
    const destino =
      e.key === "ArrowRight" ? (actual + 1) % PESTANAS.length
      : e.key === "ArrowLeft" ? (actual - 1 + PESTANAS.length) % PESTANAS.length
      : e.key === "Home" ? 0
      : e.key === "End" ? PESTANAS.length - 1
      : null;
    if (destino === null) return;
    e.preventDefault();
    const id = PESTANAS[destino][0];
    setPestana(id);
    document.getElementById(`pestana-${id}`)?.focus();
  };

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
    formState: { errors, isDirty },
  } = useForm<CuentaForm>({ resolver: zodResolver(cuentaSchema), defaultValues: VALORES_INICIALES });
  useSinGuardar(mostrarModal && isDirty);

  const rol = watch("rol");
  const password = watch("password");
  const modo = watch("modo");
  const email = watch("email");

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
    const email = d.email.trim();
    // Sin contraseña, el server crea la cuenta pendiente y manda la invitación.
    const password = d.modo === "contrasena" && email ? d.password : undefined;

    let creado: { invitacion: EstadoInvitacion | null };
    if (d.rol === "admin") {
      creado = await crearAdministrador.mutateAsync({ nombre: d.nombre, email, password });
    } else if (d.rol === "secretario") {
      creado = await crearSecretario.mutateAsync({ nombre: d.nombre, email, password });
    } else if (d.rol === "profesor") {
      creado = await crearProfesor.mutateAsync({ nombre: d.nombre, apellido, dni, telefono, email, password });
    } else {
      // Lo mínimo del responsable: nombre, apellido y celular. Sin email queda sin cuenta; el vínculo se elige al asociarlo a un alumno.
      creado = await crearPadre.mutateAsync({ nombre: d.nombre, apellido, telefono: telefono ?? "", dni: dni || undefined, email: email || undefined, password });
    }
    setMostrarModal(false);
    setToast(d.rol === "padre" && !email ? "Responsable creado sin cuenta: cargá su email para poder invitarlo" : mensajeDeAlta(email, creado.invitacion));
  });

  const alternarEstado = (cuenta: CuentaUsuario) => {
    cambiarEstado.mutate({ id: cuenta.id, estado: cuenta.estado === "activo" ? "inactivo" : "activo" });
  };

  const esCuentaPropia = (cuenta: CuentaUsuario) => cuenta.id === sesion?.id;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b" style={{ borderColor: "var(--border-hex)" }}>
        <div role="tablist" aria-label="Usuarios" className="flex gap-1" onKeyDown={moverPestana}>
          {PESTANAS.map(([id, etiqueta]) => (
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
              style={{
                borderBottom: `2px solid ${pestana === id ? "var(--brand)" : "transparent"}`,
                color: pestana === id ? "var(--brand)" : "var(--text-muted)",
              }}
            >
              {etiqueta}
            </button>
          ))}
        </div>
        <Button className="mb-2" onClick={abrirModal}>
          <UserPlus size={14} /> Crear usuario
        </Button>
      </div>

      <div role="tabpanel" id="panel-usuarios" aria-labelledby={`pestana-${pestana}`} className="space-y-4">
      {pestana === "pendientes" ? (
        <PendientesTab />
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
            {filasCuentas.map(({ item: cuenta, estado }) => (
              <tr key={cuenta.id} className={claseDeFila(estado)} style={{ opacity: cuenta.estado === "inactivo" ? 0.5 : 1 }}>
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

        </>
      )}
      </div>

      {mostrarModal && (
        <Modal
          sinGuardar={isDirty}
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
                          className="flex shrink-0 items-center justify-center"
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
                <AlertTriangle size={14} className="mt-px shrink-0" style={{ color: "var(--danger)" }} />
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
                    <label className="label">DNI{rol === "padre" && " · opcional"}</label>
                    <Input {...register("dni")} className="font-mono" />
                    {errors.dni && <p className="text-sm text-destructive">{errors.dni.message}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <label className="label">{rol === "padre" ? "Celular (WhatsApp)" : "Teléfono · opcional"}</label>
                    <Input {...register("telefono")} placeholder="351 555-1234" />
                    {errors.telefono && <p className="text-sm text-destructive">{errors.telefono.message}</p>}
                  </div>
                </>
              )}
              <div className="col-span-2 space-y-1.5">
                <label className="label">Email (usuario de acceso){rol === "padre" && " · opcional"}</label>
                <Input type="email" {...register("email")} className="font-mono" />
                {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
              </div>
              {(rol !== "padre" || email.trim() !== "") && (
              <div className="col-span-2">
                <ModoDeAcceso
                  valor={modo}
                  onCambiar={(m) => {
                    setValue("modo", m);
                    clearErrors("password");
                  }}
                />
              </div>
              )}
              {modo === "contrasena" && (rol !== "padre" || email.trim() !== "") && (
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
                      className="shrink-0"
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
              )}
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
          <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: "var(--brand-dot)" }} />
          {toast}
        </div>
      )}
    </div>
  );
}
