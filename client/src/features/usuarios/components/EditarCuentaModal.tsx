import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/core/components/ui/button";
import { Input } from "@/core/components/ui/input";
import { Modal } from "@/core/components/ui/modal";
import { AvisoDeCambioAjeno } from "@/core/formularios/AvisoDeCambioAjeno";
import { useFormularioAlDia } from "@/core/formularios/useFormularioAlDia";
import { erroresDeCampo } from "@/core/lib/erroresDeCampo";
import { emailSchema, passwordNueva, textoRequerido } from "@/core/lib/validacion";
import { useSinGuardar } from "@/core/sinGuardar/sinGuardar";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { ROL_LABELS, type Rol } from "@/features/auth/types";
import { FICHA_NUEVA_VACIA, fichaParaEnviar, type FichaElegida } from "../fichas";
import { DESCRIPCION_ROL, ORDEN_ROLES } from "../roles";
import { useActualizarCuenta } from "../hooks/useActualizarCuenta";
import { useSinCuenta } from "../hooks/useSinCuenta";
import type { ActualizarCuentaInput, CuentaUsuario } from "../types";
import { CampoPassword } from "./CampoPassword";
import { SelectorDeFicha } from "./SelectorDeFicha";

interface Props {
  // La cuenta tal como está ahora en el servidor (si otra persona la cambia mientras se edita, llega acá actualizada).
  cuenta: CuentaUsuario;
  onCerrar: () => void;
  onGuardada: (mensaje: string) => void;
}

type Basicos = { nombre: string; email: string };
const ETIQUETAS: Record<keyof Basicos, string> = { nombre: "el nombre", email: "el email" };
const AVISO_AL_QUITAR: Record<"padre" | "profesor", string> = {
  padre: "dejará de ver a sus hijos",
  profesor: "dejará de tener sus cursos a cargo",
};

// Editar una cuenta: nombre, email, contraseña y roles. La contraseña vacía no se toca. Agregar el rol de responsable o de
// profesor vincula una ficha; quitarlo la desvincula (la ficha no se borra).
export function EditarCuentaModal({ cuenta, onCerrar, onGuardada }: Props) {
  const { usuario: sesion } = useAuth();
  const actualizar = useActualizarCuenta();
  const { data: sinCuenta } = useSinCuenta();
  const [nombre, setNombre] = useState(cuenta.nombre);
  const [email, setEmail] = useState(cuenta.email);
  const [password, setPassword] = useState("");
  const [roles, setRoles] = useState<Rol[]>(cuenta.roles);
  const [fichaPadre, setFichaPadre] = useState<FichaElegida>({ ...FICHA_NUEVA_VACIA });
  const [fichaProfesor, setFichaProfesor] = useState<FichaElegida>({ ...FICHA_NUEVA_VACIA });
  const [confirmado, setConfirmado] = useState(false);
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);

  // Si otra persona cambia los roles de la cuenta mientras se edita: lo que no se tocó se pone al día; lo tocado se conserva
  // (agregados y quitados se calculan contra los roles actuales del servidor).
  const rolesDelServidor = cuenta.roles.join(",");
  const rolesPrevios = useRef(cuenta.roles);
  useEffect(() => {
    const previos = rolesPrevios.current;
    rolesPrevios.current = cuenta.roles;
    if (previos.join(",") === rolesDelServidor) return;
    setRoles((actuales) => (actuales.length === previos.length && actuales.every((r) => previos.includes(r)) ? cuenta.roles : actuales));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rolesDelServidor]);

  const esPropia = cuenta.id === sesion?.id;
  // El nombre de una cuenta con ficha se cambia desde la ficha (así no quedan distintos).
  const nombreDeFicha = cuenta.roles.includes("padre") || cuenta.roles.includes("profesor");

  const servidor = useMemo<Basicos>(() => ({ nombre: cuenta.nombre, email: cuenta.email }), [cuenta.nombre, cuenta.email]);
  const alDia = useFormularioAlDia<Basicos>({
    activo: true,
    dato: "usuarios",
    claveDeId: "usuarioIds",
    id: cuenta.id,
    servidor,
    etiquetas: ETIQUETAS,
    valores: { nombre, email },
    aplicar: (parcial) => {
      if (parcial.nombre !== undefined) setNombre(parcial.nombre);
      if (parcial.email !== undefined) setEmail(parcial.email);
    },
  });
  const base = alDia.base ?? servidor;

  const agregados = roles.filter((r) => !cuenta.roles.includes(r));
  const quitados = cuenta.roles.filter((r) => !roles.includes(r));
  const quitaFicha = quitados.filter((r): r is "padre" | "profesor" => r === "padre" || r === "profesor");
  const modificado = nombre !== base.nombre || email !== base.email || password !== "" || agregados.length + quitados.length > 0;
  useSinGuardar(modificado);

  const fichasDe = (tipo: "padre" | "profesor") => (sinCuenta ?? []).filter((f) => f.tipo === tipo);
  const alternarRol = (rol: Rol) => {
    if (esPropia && rol === "admin") return;
    setRoles((actuales) => (actuales.includes(rol) ? actuales.filter((r) => r !== rol) : [...actuales, rol]));
    setConfirmado(false);
    setErrores({});
  };
  const erroresDe = (prefijo: string) => Object.fromEntries(Object.entries(errores).filter(([k]) => k.startsWith(`${prefijo}.`)).map(([k, v]) => [k.slice(prefijo.length + 1), v]));

  const guardar = async () => {
    const e: Record<string, string> = {};
    const emailNormalizado = emailSchema.safeParse(email);
    if (!emailNormalizado.success) e.email = "Email inválido";
    const nombreValido = textoRequerido("El nombre", 60).safeParse(nombre);
    if (!nombreDeFicha && nombre !== base.nombre && !nombreValido.success) e.nombre = nombreValido.error.issues[0].message;
    if (password !== "") {
      const p = passwordNueva.safeParse(password);
      if (!p.success) e.password = p.error.issues[0].message;
    }
    if (roles.length === 0) e.roles = "La cuenta tiene que conservar al menos un rol: si ya no tiene que entrar, desactivala";
    const datos: ActualizarCuentaInput = {};
    if (agregados.includes("padre")) {
      const r = fichaParaEnviar("padre", fichaPadre);
      if (r.ok) datos.padre = r.ref;
      else Object.assign(e, Object.fromEntries(Object.entries(r.errores).map(([k, v]) => [`padre.${k}`, v])));
    }
    if (agregados.includes("profesor")) {
      const r = fichaParaEnviar("profesor", fichaProfesor);
      if (r.ok) datos.profesor = r.ref;
      else Object.assign(e, Object.fromEntries(Object.entries(r.errores).map(([k, v]) => [`profesor.${k}`, v])));
    }
    setErrores(e);
    setErrorGeneral(null);
    if (Object.keys(e).length > 0 || !emailNormalizado.success) return;
    if (!nombreDeFicha && nombre.trim() !== base.nombre) datos.nombre = nombre.trim();
    if (emailNormalizado.data !== base.email) datos.email = emailNormalizado.data as string;
    if (password !== "") datos.password = password;
    if (agregados.length + quitados.length > 0) datos.roles = roles;
    if (Object.keys(datos).length === 0) {
      setErrorGeneral("No hay cambios para guardar");
      return;
    }
    try {
      await actualizar.mutateAsync({ id: cuenta.id, datos });
      onGuardada(`Cambios guardados en la cuenta de ${cuenta.nombre}`);
    } catch (error) {
      const { campos, general } = erroresDeCampo(error);
      setErrores({ ...(campos.email ? { email: campos.email } : {}), ...(campos.password ? { password: campos.password } : {}), ...(campos.roles ? { roles: campos.roles } : {}), ...(campos.nombre ? { nombre: campos.nombre } : {}) });
      setErrorGeneral(general ?? (Object.keys(campos).length > 0 ? Object.values(campos).join(" · ") : "No se pudo guardar"));
    }
  };

  const bloqueado = quitaFicha.length > 0 && !confirmado;

  return (
    <Modal
      title="Editar cuenta"
      sinGuardar={modificado}
      onClose={onCerrar}
      footer={
        <>
          <Button variant="outline" className="flex-1" onClick={onCerrar}>
            Cancelar
          </Button>
          <Button className="flex-1" data-guardar-cuenta disabled={actualizar.isPending || bloqueado} onClick={() => void guardar()}>
            {actualizar.isPending ? "Guardando…" : "Guardar cambios"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <AvisoDeCambioAjeno aviso={alDia.aviso} onCerrar={alDia.descartarAviso} />

        <div className="space-y-1.5">
          <label className="label">Nombre</label>
          <Input data-nombre value={nombre} disabled={nombreDeFicha} onChange={(e) => setNombre(e.target.value)} className={alDia.resaltados.has("nombre") ? "cambio-resaltado" : undefined} />
          {nombreDeFicha && <p className="text-[11.5px] text-muted-foreground">El nombre de un responsable o profesor se cambia desde su ficha.</p>}
          {errores.nombre && <p className="text-sm text-destructive">{errores.nombre}</p>}
        </div>

        <div className="space-y-1.5">
          <label className="label">Email (usuario de acceso)</label>
          <Input data-email type="email" className={`font-mono ${alDia.resaltados.has("email") ? "cambio-resaltado" : ""}`} value={email} onChange={(e) => setEmail(e.target.value)} />
          {errores.email && <p className="text-sm text-destructive">{errores.email}</p>}
        </div>

        <div className="space-y-1.5">
          <label className="label" htmlFor="editarPassword">
            Contraseña nueva
          </label>
          <CampoPassword id="editarPassword" valor={password} onCambiar={setPassword} error={errores.password} placeholder="Vacía: no se cambia" ayuda="Si la cambiás, se cierran todas las sesiones abiertas de esta persona." />
        </div>

        <div>
          <label className="label">Roles</label>
          <div className="space-y-1.5">
            {ORDEN_ROLES.map((valor) => {
              const marcado = roles.includes(valor);
              const propiaAdmin = esPropia && valor === "admin";
              return (
                <label
                  key={valor}
                  className="flex cursor-pointer items-start gap-2.5 px-3.5 py-2.5"
                  style={{ border: `1px solid ${marcado ? "var(--brand)" : "var(--border-hex)"}`, background: marcado ? "var(--brand-soft)" : "var(--bg)", borderRadius: 4, opacity: propiaAdmin ? 0.6 : 1 }}
                >
                  <input type="checkbox" data-rol={valor} className="mt-0.5 accent-[var(--brand)]" checked={marcado} disabled={propiaAdmin} onChange={() => alternarRol(valor)} />
                  <span>
                    <span className="text-[13px] font-medium">{ROL_LABELS[valor]}</span>
                    {propiaAdmin && <span className="ml-1.5 text-[11.5px] text-muted-foreground">· no podés quitarte tu propio rol de administrador</span>}
                    <span className="block text-[11.5px] text-muted-foreground">{DESCRIPCION_ROL[valor]}</span>
                  </span>
                </label>
              );
            })}
          </div>
          {errores.roles && <p className="mt-1.5 text-sm text-destructive">{errores.roles}</p>}
          {agregados.length + quitados.length > 0 && <p className="mt-1.5 text-[11.5px] text-muted-foreground">Al cambiar los roles se cierran las sesiones abiertas de esta persona.</p>}
        </div>

        {agregados.includes("padre") && <SelectorDeFicha tipo="padre" valor={fichaPadre} onCambiar={setFichaPadre} fichas={fichasDe("padre")} errores={erroresDe("padre")} />}
        {agregados.includes("profesor") && <SelectorDeFicha tipo="profesor" valor={fichaProfesor} onCambiar={setFichaProfesor} fichas={fichasDe("profesor")} errores={erroresDe("profesor")} />}

        {quitaFicha.length > 0 && (
          <label data-confirmar-quitar className="flex cursor-pointer items-start gap-2.5 rounded-md px-3.5 py-3 text-[12.5px]" style={{ background: "var(--warning-soft)", border: "1px solid var(--warning)" }}>
            <input type="checkbox" className="mt-0.5 accent-[var(--brand)]" checked={confirmado} onChange={(e) => setConfirmado(e.target.checked)} />
            <span>
              Entiendo que {quitaFicha.map((r) => `como ${ROL_LABELS[r].toLowerCase()} ${AVISO_AL_QUITAR[r]}`).join(" y ")}. La ficha no se borra: vuelve a "Sin cuenta".
            </span>
          </label>
        )}

        {errorGeneral && <p className="text-sm text-destructive">{errorGeneral}</p>}
      </div>
    </Modal>
  );
}
