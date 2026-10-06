import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AlertCircle, ArrowLeft, Eye, EyeOff, Loader2, Lock } from "lucide-react";
import { ApiError } from "@/core/lib/apiClient";
import { authService } from "../authService";
import { AuthLayout } from "../components/AuthLayout";

const ENLACE_INVALIDO = "El enlace no es válido o ya venció. Pedí uno nuevo.";

const schema = z
  .object({
    password: z
      .string()
      .min(8, "La contraseña debe tener al menos 8 caracteres")
      .max(72, "La contraseña puede tener como máximo 72 caracteres"),
    repetir: z.string(),
  })
  .refine((d) => d.password === d.repetir, { path: ["repetir"], message: "Las contraseñas no coinciden" });
type Formulario = z.infer<typeof schema>;

export default function RestablecerContrasenaPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  // Se lee una sola vez y se quita de la barra de direcciones, para que el token
  // no quede en el historial del navegador.
  const [token] = useState(() => params.get("token") ?? "");
  useEffect(() => {
    if (params.has("token")) window.history.replaceState(null, "", "/restablecer-contrasena");
  }, [params]);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Formulario>({ resolver: zodResolver(schema) });
  const [mostrar, setMostrar] = useState(false);
  const [error, setError] = useState<string | null>(token ? null : ENLACE_INVALIDO);

  const onSubmit = async ({ password }: Formulario) => {
    setError(null);
    try {
      await authService.restablecerContrasena(token, password);
      navigate("/login?motivo=contrasena-actualizada", { replace: true });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "No se pudo cambiar la contraseña. Probá de nuevo.");
    }
  };

  const campo = (id: "password" | "repetir", etiqueta: string, autoComplete: string) => (
    <div>
      <label className="label" htmlFor={id}>
        {etiqueta}
      </label>
      <div className="relative">
        <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-faint)" }} />
        <input
          id={id}
          type={mostrar ? "text" : "password"}
          autoComplete={autoComplete}
          placeholder="••••••••"
          className="input"
          style={{ paddingLeft: 34, paddingRight: 36, paddingTop: 10, paddingBottom: 10 }}
          {...register(id)}
        />
        <button
          type="button"
          onClick={() => setMostrar((v) => !v)}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 hover:bg-zinc-100"
          style={{ color: "var(--text-muted)" }}
          title={mostrar ? "Ocultar" : "Mostrar"}
        >
          {mostrar ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
      </div>
      {errors[id] && <p className="mt-1.5 text-[12px] text-destructive">{errors[id]?.message}</p>}
    </div>
  );

  return (
    <AuthLayout>
      {/* El enlace lleva el token: que no se filtre a otros sitios como referrer. */}
      <meta name="referrer" content="no-referrer" />
      <p className="eyebrow mb-3">Acceso al sistema</p>
      <h2 style={{ fontSize: 26, fontWeight: 600, letterSpacing: "-0.02em", lineHeight: 1.15, color: "var(--text)" }}>
        Elegí una contraseña nueva
      </h2>
      <p className="mt-2 text-[13.5px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
        Al guardarla se cierran las sesiones abiertas de tu cuenta.
      </p>

      {token && (
        <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-4" noValidate>
          {campo("password", "Contraseña nueva", "new-password")}
          {campo("repetir", "Repetir contraseña", "new-password")}
          {error && <Aviso texto={error} />}
          <button
            type="submit"
            disabled={isSubmitting}
            className="btn btn-primary w-full justify-center"
            style={{ padding: "12px 16px", fontSize: 14 }}
          >
            {isSubmitting ? (
              <>
                <Loader2 size={15} strokeWidth={2} className="animate-spin" />
                Guardando…
              </>
            ) : (
              "Guardar contraseña"
            )}
          </button>
        </form>
      )}
      {!token && error && (
        <div className="mt-8">
          <Aviso texto={error} />
        </div>
      )}

      <div className="my-8" style={{ height: 1, background: "var(--border-hex)" }} />

      <div className="flex flex-wrap items-center justify-between gap-2 text-[12.5px] font-medium">
        <Link to="/login" className="flex items-center gap-1.5 hover:underline" style={{ color: "var(--brand)" }}>
          <ArrowLeft size={13} /> Volver al inicio de sesión
        </Link>
        <Link to="/olvide-contrasena" className="hover:underline" style={{ color: "var(--brand)" }}>
          Pedir otro enlace
        </Link>
      </div>
    </AuthLayout>
  );
}

function Aviso({ texto }: { texto: string }) {
  return (
    <div
      className="flex items-start gap-2 px-3.5 py-3"
      style={{ background: "var(--danger-soft)", border: "1px solid var(--danger)", borderRadius: 4 }}
    >
      <AlertCircle size={14} style={{ color: "var(--danger)", flexShrink: 0, marginTop: 1 }} />
      <span className="text-[12.5px]" style={{ color: "var(--danger)" }}>
        {texto}
      </span>
    </div>
  );
}
