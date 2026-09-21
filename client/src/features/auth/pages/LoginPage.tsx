import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AlertCircle, ArrowRight, Eye, EyeOff, Loader2, Lock, Mail } from "lucide-react";
import logoTintaBlanca from "@/assets/babylon-logo-tinta-blanca.png";
import { ApiError } from "@/core/lib/apiClient";
import { useLogin } from "../hooks/useAuth";
import { ROL_LABELS, type Rol } from "../types";

const loginSchema = z.object({
  email: z.string().email("Ingresá un email válido"),
  password: z.string().min(1, "La contraseña es requerida"),
});

type LoginForm = z.infer<typeof loginSchema>;

function BrandPanel() {
  return (
    <div
      className="relative hidden flex-col lg:flex lg:w-[44%] xl:w-[46%]"
      style={{ background: "#0F3D2E" }}
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />

      <div className="relative px-14 pt-12 xl:px-20">
        <div className="flex items-center gap-3">
          <img src={logoTintaBlanca} alt="Babylon English Institute" style={{ width: 38, height: 38, objectFit: "contain" }} />
          <div className="leading-none">
            <div className="text-white" style={{ fontSize: 18, fontWeight: 600, letterSpacing: "-0.015em" }}>
              Babylon
            </div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.55)", fontWeight: 500, letterSpacing: "0.18em", textTransform: "uppercase", marginTop: 5 }}>
              English Institute
            </div>
          </div>
        </div>
      </div>

      <div className="relative flex flex-1 flex-col justify-center px-14 xl:px-20">
        <img
          src={logoTintaBlanca}
          alt="Babylon English Institute"
          className="relative mb-12"
          style={{ width: 96, height: 96, objectFit: "contain" }}
        />

        <p className="text-white" style={{ fontSize: 11, fontWeight: 500, letterSpacing: "0.22em", textTransform: "uppercase", opacity: 0.55, marginBottom: 14 }}>
          Sistema de gestión académica
        </p>
        <h1 className="leading-none text-white" style={{ fontSize: 48, fontWeight: 600, letterSpacing: "-0.025em" }}>
          Babylon
        </h1>
        <p className="mt-3" style={{ fontSize: 16, fontWeight: 400, color: "rgba(255,255,255,0.7)", letterSpacing: "-0.005em" }}>
          English Institute
        </p>

        <div className="mb-8 mt-12" style={{ width: 36, height: 1, background: "rgba(255,255,255,0.35)" }} />

        <p style={{ fontSize: 14.5, color: "rgba(255,255,255,0.82)", maxWidth: 360, lineHeight: 1.65, letterSpacing: "-0.005em" }}>
          Una plataforma única para administrativos, profesores y familias. Asistencia, calificaciones y cuotas en un
          solo lugar.
        </p>
      </div>

      <div className="relative flex items-center justify-between px-14 pb-10 xl:px-20">
        <span style={{ fontSize: 11, fontWeight: 500, color: "rgba(255,255,255,0.4)", letterSpacing: "0.08em" }}>
          BABYLON ENGLISH INSTITUTE
        </span>
      </div>
    </div>
  );
}

export default function LoginPage() {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) });

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
    <div className="flex min-h-screen flex-col lg:flex-row">
      <BrandPanel />

      <div className="flex min-h-screen flex-1 flex-col bg-white lg:min-h-0">
        <div className="px-6 py-6 lg:hidden" style={{ background: "#0F3D2E" }}>
          <div className="flex items-center gap-3">
            <img src={logoTintaBlanca} alt="Babylon English Institute" style={{ width: 34, height: 34, objectFit: "contain" }} />
            <div className="leading-none">
              <div className="text-white" style={{ fontSize: 16, fontWeight: 600, letterSpacing: "-0.015em" }}>
                Babylon
              </div>
              <div style={{ fontSize: 9.5, color: "rgba(255,255,255,0.55)", fontWeight: 500, letterSpacing: "0.16em", textTransform: "uppercase", marginTop: 4 }}>
                English Institute
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-1 items-center justify-center px-6 py-12">
          <div className="w-full max-w-[380px]">
            <p className="eyebrow mb-3">Acceso al sistema</p>
            <h2 style={{ fontSize: 26, fontWeight: 600, letterSpacing: "-0.02em", lineHeight: 1.15, color: "var(--text)" }}>
              {seleccionRol ? "Elegí con qué rol entrar" : "Iniciar sesión"}
            </h2>
            <p className="mt-2 text-[13.5px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
              {seleccionRol
                ? "Esta cuenta tiene más de un rol habilitado."
                : "Ingresá con tu cuenta institucional para continuar."}
            </p>

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
          </div>
        </div>

        <div className="hidden items-center justify-between px-12 pb-8 lg:flex" style={{ fontSize: 11, color: "var(--text-faint)" }}>
          <span>© 2026 Babylon English Institute</span>
        </div>
      </div>
    </div>
  );
}
