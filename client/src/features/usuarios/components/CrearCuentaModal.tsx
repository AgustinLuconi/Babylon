import { useEffect, useMemo, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/core/components/ui/button";
import { Input } from "@/core/components/ui/input";
import { Modal } from "@/core/components/ui/modal";
import { erroresDeCampo } from "@/core/lib/erroresDeCampo";
import { emailSchema, passwordNueva } from "@/core/lib/validacion";
import { useSinGuardar } from "@/core/sinGuardar/sinGuardar";
import { ROL_LABELS, type Rol } from "@/features/auth/types";
import { FICHA_NUEVA_VACIA, fichaParaEnviar, type FichaElegida } from "../fichas";
import { DESCRIPCION_ROL, ORDEN_ROLES } from "../roles";
import { useCrearCuenta } from "../hooks/useCrearCuenta";
import { useCuentaPorEmail } from "../hooks/useCuentaPorEmail";
import { useSinCuenta } from "../hooks/useSinCuenta";
import type { CrearCuentaInput, FilaSinCuenta } from "../types";
import { CampoPassword } from "./CampoPassword";
import { SelectorDeFicha } from "./SelectorDeFicha";

interface Props {
  // Desde "Sin cuenta": la ficha de la que se crea la cuenta (el rol y la ficha vienen elegidos y el email, autocompletado).
  ficha?: FilaSinCuenta;
  onCerrar: () => void;
  onCreada: (mensaje: string) => void;
}

// Crear una cuenta con uno o varios roles. Si el email ya es de una cuenta, no se crea otra: se le agregan los roles (y su
// contraseña no cambia), y el aviso lo dice antes de guardar.
export function CrearCuentaModal({ ficha, onCerrar, onCreada }: Props) {
  const crear = useCrearCuenta();
  const { data: sinCuenta } = useSinCuenta();
  const [roles, setRoles] = useState<Rol[]>(ficha ? [ficha.tipo] : []);
  const [email, setEmail] = useState(ficha?.email ?? "");
  const [password, setPassword] = useState("");
  const [nombre, setNombre] = useState("");
  const [fichaPadre, setFichaPadre] = useState<FichaElegida>(ficha?.tipo === "padre" ? { modo: "existente", fichaId: ficha.fichaId } : { ...FICHA_NUEVA_VACIA });
  const [fichaProfesor, setFichaProfesor] = useState<FichaElegida>(ficha?.tipo === "profesor" ? { modo: "existente", fichaId: ficha.fichaId } : { ...FICHA_NUEVA_VACIA });
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);

  // ¿Ese email ya tiene cuenta? Se consulta con el email completo y válido, esperando a que termine de escribirse.
  const emailValido = emailSchema.safeParse(email).success;
  const [emailParaConsultar, setEmailParaConsultar] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setEmailParaConsultar(emailValido ? (emailSchema.parse(email) as string) : ""), 300);
    return () => clearTimeout(t);
  }, [email, emailValido]);
  const { data: existente } = useCuentaPorEmail(emailParaConsultar);
  const hayExistente = Boolean(existente) && emailParaConsultar !== "";
  const rolesQueYaTiene = hayExistente ? (existente?.roles ?? []) : [];
  const rolesAAgregar = roles.filter((r) => !rolesQueYaTiene.includes(r));

  const sinFicha = !roles.includes("padre") && !roles.includes("profesor");
  const fichasDe = (tipo: "padre" | "profesor") => (sinCuenta ?? []).filter((f) => f.tipo === tipo);

  const modificado = roles.length !== (ficha ? 1 : 0) || email !== (ficha?.email ?? "") || password !== "" || nombre !== "";
  useSinGuardar(modificado);

  const alternarRol = (rol: Rol) => {
    if (ficha || rolesQueYaTiene.includes(rol)) return;
    setRoles((actuales) => (actuales.includes(rol) ? actuales.filter((r) => r !== rol) : [...actuales, rol]));
    setErrores({});
  };

  const enviar = async () => {
    const e: Record<string, string> = {};
    if (roles.length === 0) e.roles = "Elegí al menos un rol";
    else if (hayExistente && rolesAAgregar.length === 0) e.roles = "Esa cuenta ya tiene todos los roles elegidos";
    if (!emailValido) e.email = "Email inválido";
    if (!hayExistente) {
      const p = passwordNueva.safeParse(password);
      if (!p.success) e.password = p.error.issues[0].message;
    }
    if (sinFicha && !nombre.trim()) e.nombre = "El nombre es requerido";
    let padre: CrearCuentaInput["padre"];
    let profesor: CrearCuentaInput["profesor"];
    if (roles.includes("padre")) {
      const r = fichaParaEnviar("padre", fichaPadre);
      if (r.ok) padre = r.ref;
      else Object.assign(e, Object.fromEntries(Object.entries(r.errores).map(([k, v]) => [`padre.${k}`, v])));
    }
    if (roles.includes("profesor")) {
      const r = fichaParaEnviar("profesor", fichaProfesor);
      if (r.ok) profesor = r.ref;
      else Object.assign(e, Object.fromEntries(Object.entries(r.errores).map(([k, v]) => [`profesor.${k}`, v])));
    }
    setErrores(e);
    setErrorGeneral(null);
    if (Object.keys(e).length > 0) return;
    try {
      const respuesta = await crear.mutateAsync({
        email: emailSchema.parse(email) as string,
        password: hayExistente ? undefined : password,
        nombre: sinFicha ? nombre.trim() : undefined,
        roles,
        padre,
        profesor,
      });
      onCreada(
        respuesta.vinculada
          ? `Se agregó ${rolesAAgregar.map((r) => ROL_LABELS[r]).join(" y ")} a la cuenta de ${respuesta.usuario.nombre} (su contraseña no cambió)`
          : `Cuenta creada para ${respuesta.usuario.nombre}`,
      );
    } catch (error) {
      const { campos, general } = erroresDeCampo(error);
      setErrores({ ...(campos.email ? { email: campos.email } : {}), ...(campos.password ? { password: campos.password } : {}), ...(campos.nombre ? { nombre: campos.nombre } : {}) });
      setErrorGeneral(general ?? (Object.keys(campos).length > 0 ? Object.values(campos).join(" · ") : "No se pudo crear la cuenta"));
    }
  };

  const titulo = ficha ? "Crear cuenta" : "Crear usuario";
  const erroresDe = useMemo(
    () => (prefijo: "padre" | "profesor") => Object.fromEntries(Object.entries(errores).filter(([k]) => k.startsWith(`${prefijo}.`)).map(([k, v]) => [k.slice(prefijo.length + 1), v])),
    [errores],
  );

  return (
    <Modal
      title={titulo}
      sinGuardar={modificado}
      onClose={onCerrar}
      footer={
        <>
          <Button variant="outline" className="flex-1" onClick={onCerrar}>
            Cancelar
          </Button>
          <Button className="flex-1" data-crear-cuenta disabled={crear.isPending} onClick={() => void enviar()}>
            {crear.isPending ? "Guardando…" : hayExistente ? "Agregar el rol" : titulo}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {ficha && (
          <p className="rounded-md px-3 py-2 text-[12.5px]" style={{ background: "var(--bg-subtle)" }}>
            {ficha.tipo === "padre" ? "Responsable" : "Profesor"}: <span className="font-medium">{ficha.nombre}</span>
          </p>
        )}

        {!ficha && (
          <div>
            <label className="label">Roles</label>
            <div className="space-y-1.5">
              {ORDEN_ROLES.map((valor) => {
                const marcado = roles.includes(valor);
                const yaLoTiene = rolesQueYaTiene.includes(valor);
                return (
                  <label
                    key={valor}
                    className="flex cursor-pointer items-start gap-2.5 px-3.5 py-2.5"
                    style={{
                      border: `1px solid ${marcado ? "var(--brand)" : "var(--border-hex)"}`,
                      background: marcado ? "var(--brand-soft)" : "var(--bg)",
                      borderRadius: 4,
                      opacity: yaLoTiene ? 0.55 : 1,
                    }}
                  >
                    <input type="checkbox" data-rol={valor} className="mt-0.5 accent-[var(--brand)]" checked={marcado} disabled={yaLoTiene} onChange={() => alternarRol(valor)} />
                    <span>
                      <span className="text-[13px] font-medium">{ROL_LABELS[valor]}</span>
                      {yaLoTiene && <span className="ml-1.5 text-[11.5px] text-muted-foreground">· esa cuenta ya lo tiene</span>}
                      <span className="block text-[11.5px] text-muted-foreground">{DESCRIPCION_ROL[valor]}</span>
                    </span>
                  </label>
                );
              })}
            </div>
            {errores.roles && <p className="mt-1.5 text-sm text-destructive">{errores.roles}</p>}
          </div>
        )}

        {roles.includes("admin") && (
          <div className="flex items-start gap-2 px-3.5 py-3" style={{ background: "var(--danger-soft)", border: "1px solid var(--danger)", borderRadius: 4 }}>
            <AlertTriangle size={14} className="mt-px shrink-0" style={{ color: "var(--danger)" }} />
            <p className="text-[12px]" style={{ color: "var(--danger)" }}>
              Acceso total al sistema. Asignar únicamente a personal de máxima confianza.
            </p>
          </div>
        )}

        {!ficha && roles.includes("padre") && (
          <SelectorDeFicha tipo="padre" valor={fichaPadre} onCambiar={setFichaPadre} fichas={fichasDe("padre")} errores={erroresDe("padre")} />
        )}
        {!ficha && roles.includes("profesor") && (
          <SelectorDeFicha tipo="profesor" valor={fichaProfesor} onCambiar={setFichaProfesor} fichas={fichasDe("profesor")} errores={erroresDe("profesor")} />
        )}

        {sinFicha && roles.length > 0 && !hayExistente && (
          <div className="space-y-1.5">
            <label className="label">Nombre completo</label>
            <Input data-nombre value={nombre} onChange={(e) => setNombre(e.target.value)} />
            {errores.nombre && <p className="text-sm text-destructive">{errores.nombre}</p>}
          </div>
        )}

        <div className="space-y-1.5">
          <label className="label" htmlFor="cuentaEmail">
            Email (usuario de acceso)
          </label>
          <Input id="cuentaEmail" data-email type="email" className="font-mono" value={email} onChange={(e) => setEmail(e.target.value)} />
          {errores.email && <p className="text-sm text-destructive">{errores.email}</p>}
        </div>

        {hayExistente && existente ? (
          <p data-aviso-existente className="rounded-md px-3 py-2.5 text-[12.5px]" style={{ background: "var(--warning-soft)", border: "1px solid var(--warning)" }}>
            Ese email ya tiene cuenta ({existente.nombre}{existente.estado === "inactivo" ? ", desactivada" : ""}): se le va a agregar {rolesAAgregar.length > 0 ? rolesAAgregar.map((r) => `el rol de ${ROL_LABELS[r].toLowerCase()}`).join(" y ") : "lo que elijas"}. Su contraseña no cambia.{existente.estado === "inactivo" && " La cuenta sigue desactivada: no podrá entrar hasta que la reactives desde Cuentas."}
          </p>
        ) : (
          <div className="space-y-1.5">
            <label className="label" htmlFor="cuentaPassword">
              Contraseña
            </label>
            <CampoPassword id="cuentaPassword" valor={password} onCambiar={setPassword} error={errores.password} ayuda="Al menos 8 caracteres. Se la pasás vos a la persona." />
          </div>
        )}

        {errorGeneral && <p className="text-sm text-destructive">{errorGeneral}</p>}
      </div>
    </Modal>
  );
}
