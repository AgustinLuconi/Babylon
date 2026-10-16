import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AlertCircle, ArrowRight, Eye, EyeOff, Loader2, Lock, Mail } from "lucide-react";
import { ApiError } from "@/core/lib/apiClient";
import { AuthLayout } from "../components/AuthLayout";
import { useLogin } from "../hooks/useAuth";
import { ROL_LABELS, type Rol } from "../types";

const loginSchema = z.object({
  email: z.email("Ingresá un email válido"),
  password: z.string().min(1, "La contraseña es requerida"),
  recordarme: z.boolean().optional(),
});

type LoginForm = z.infer<typeof loginSchema>;

// Avisos que llegan por ?motivo= desde otras pantallas.
const MENSAJES_MOTIVO: Record<string, { texto: string; tono: "warning" | "success" }> = {
  "sesion-vencida": { texto: "Tu sesión venció, ingresá de nuevo.", tono: "warning" },
  "contrasena-actualizada": { texto: "Contraseña actualizada, ya podés ingresar.", tono: "success" },
  "cuenta-activada": { texto: "Cuenta activada. Ingresá con tu email y contraseña.", tono: "success" },
  "cerrada-por-el-usuario": { texto: "Cerraste la sesión en otra pestaña.", tono: "warning" },
  "cerrada-desde-otro-dispositivo": { texto: "Tu sesión se cerró desde otro dispositivo.", tono: "warning" },
  "contrasena-cambiada": { texto: "Tu contraseña cambió: ingresá con la nueva.", tono: "warning" },
  "cuenta-desactivada": { texto: "Tu cuenta fue desactivada. Consultá con el instituto.", tono: "warning" },
};

export default function LoginPage() {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema), defaultValues: { recordarme: false } });
  const [params] = useSearchParams();
  const aviso = MENSAJES_MOTIVO[params.get("motivo") ?? ""];

  const login = useLogin();
  const [credenciales, setCredenciales] = useState<LoginForm | null>(null);
  const [mostrarPassword, setMostrarPassword] = useState(false);

  const onSubmit = (datos: LoginForm) => {
    setCredenciales(datos);
    login.mutate(datos);
  };

  const elegirRol = (rolElegido: Rol) => {
    if (!credenciales) return;
    login.mutate({ ...credenciales, rolElegido });
  };

  const resultado = login.data;
  const seleccionRol = resultado && resultado.requiereSeleccionRol ? resultado : undefined;
  const error = login.isError
    ? login.error instanceof ApiError
      ? login.error.message
      : "No se pudo iniciar sesión"
    : null;

  return (
    <AuthLayout>
      <p className="eyebrow mb-3">Acceso al sistema</p>
      <h2 style={{ fontSize: 26, fontWeight: 600, letterSpacing: "-0.02em", lineHeight: 1.15, color: "var(--text)" }}>
        {seleccionRol ? "Elegí con qué rol entrar" : "Iniciar sesión"}
      </h2>
      <p className="mt-2 text-[13.5px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
        {seleccionRol
          ? "Esta cuenta tiene más de un rol habilitado."
          : "Ingresá con tu cuenta institucional para continuar."}
      </p>

      {aviso && !seleccionRol && (
        <p
          className="mt-6 rounded border px-3.5 py-3 text-[12.5px]"
          style={{ borderColor: `var(--${aviso.tono})`, background: `var(--${aviso.tono}-soft)`, color: `var(--${aviso.tono})` }}
        >
          {aviso.texto}
        </p>
      )}

      {seleccionRol ? (
        <div className="mt-8 space-y-2.5">
          {seleccionRol.rolesDisponibles.map((rol) => (
            <button
              key={rol}
              type="button"
              disabled={login.isPending}
              onClick={() => elegirRol(rol)}
              className="btn btn-secondary w-full justify-start"
              style={{ padding: "12px 16px", fontSize: 14 }}
            >
              Entrar como {ROL_LABELS[rol]}
            </button>
          ))}
          {error && (
            <div
              className="flex items-start gap-2 px-3.5 py-3"
              style={{ background: "var(--danger-soft)", border: "1px solid var(--danger)", borderRadius: 4 }}
            >
              <AlertCircle size={14} style={{ color: "var(--danger)", flexShrink: 0, marginTop: 1 }} />
              <span className="text-[12.5px]" style={{ color: "var(--danger)" }}>
                {error}
              </span>
            </div>
          )}
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-4" noValidate>
          <div>
            <label className="label" htmlFor="email">
              Correo institucional
            </label>
            <div className="relative">
              <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-faint)" }} />
              <input
                id="email"
                type="email"
                autoComplete="username"
                placeholder="usuario@babylon.test"
                className="input"
                style={{ paddingLeft: 34, paddingTop: 10, paddingBottom: 10 }}
                {...register("email")}
              />
            </div>
            {errors.email && <p className="mt-1.5 text-[12px] text-destructive">{errors.email.message}</p>}
          </div>

          <div>
            <label className="label" htmlFor="password">
              Contraseña
            </label>
            <div className="relative">
              <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-faint)" }} />
              <input
                id="password"
                type={mostrarPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="••••••••"
                className="input"
                style={{ paddingLeft: 34, paddingRight: 36, paddingTop: 10, paddingBottom: 10 }}
                {...register("password")}
              />
              <button
                type="button"
                onClick={() => setMostrarPassword((v) => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 hover:bg-zinc-100"
                style={{ color: "var(--text-muted)" }}
              >
                {mostrarPassword ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
            {errors.password && <p className="mt-1.5 text-[12px] text-destructive">{errors.password.message}</p>}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="flex cursor-pointer items-center gap-2 text-[12.5px]" style={{ color: "var(--text-muted)" }}>
              <input type="checkbox" className="h-3.5 w-3.5 accent-[var(--brand)]" {...register("recordarme")} />
              Mantener sesión iniciada
            </label>
            <Link to="/olvide-contrasena" className="text-[12.5px] font-medium hover:underline" style={{ color: "var(--brand)" }}>
              ¿Olvidaste tu contraseña?
            </Link>
          </div>

          {error && (
            <div
              className="flex items-start gap-2 px-3.5 py-3"
              style={{ background: "var(--danger-soft)", border: "1px solid var(--danger)", borderRadius: 4 }}
            >
              <AlertCircle size={14} style={{ color: "var(--danger)", flexShrink: 0, marginTop: 1 }} />
              <span className="text-[12.5px]" style={{ color: "var(--danger)" }}>
                {error}
              </span>
            </div>
          )}

          <button
            type="submit"
            disabled={login.isPending}
            className="btn btn-primary w-full justify-center"
            style={{ padding: "12px 16px", fontSize: 14 }}
          >
            {login.isPending ? (
              <>
                <Loader2 size={15} strokeWidth={2} className="animate-spin" />
                Verificando…
              </>
            ) : (
              <>
                Ingresar al sistema <ArrowRight size={14} />
              </>
            )}
          </button>
        </form>
      )}

      <div className="my-8" style={{ height: 1, background: "var(--border-hex)" }} />

      <p className="text-center text-[12px] leading-relaxed" style={{ color: "var(--text-faint)" }}>
        Si no tenés cuenta, comunicate con la administración del instituto.
      </p>
    </AuthLayout>
  );
}
