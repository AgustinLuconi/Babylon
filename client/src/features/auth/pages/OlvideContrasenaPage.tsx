import { useState } from "react";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AlertCircle, ArrowLeft, CheckCircle2, Loader2, Mail } from "lucide-react";
import { ApiError } from "@/core/lib/apiClient";
import { authService } from "../authService";
import { AuthLayout } from "../components/AuthLayout";

const schema = z.object({ email: z.email("Ingresá un email válido") });
type Formulario = z.infer<typeof schema>;

export default function OlvideContrasenaPage() {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Formulario>({ resolver: zodResolver(schema) });
  const [confirmacion, setConfirmacion] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async ({ email }: Formulario) => {
    setError(null);
    try {
      const { mensaje } = await authService.solicitarRecuperacion(email);
      setConfirmacion(mensaje);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "No se pudo enviar el pedido. Probá de nuevo.");
    }
  };

  return (
    <AuthLayout>
      <p className="eyebrow mb-3">Acceso al sistema</p>
      <h2 style={{ fontSize: 26, fontWeight: 600, letterSpacing: "-0.02em", lineHeight: 1.15, color: "var(--text)" }}>
        Recuperar contraseña
      </h2>
      <p className="mt-2 text-[13.5px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
        Escribí el email de tu cuenta y te enviamos un enlace para elegir una nueva.
      </p>

      {confirmacion ? (
        <div
          className="mt-8 flex items-start gap-2 px-3.5 py-3"
          style={{ background: "var(--success-soft)", border: "1px solid var(--success)", borderRadius: 4 }}
        >
          <CheckCircle2 size={14} style={{ color: "var(--success)", flexShrink: 0, marginTop: 1 }} />
          <span className="text-[12.5px] leading-relaxed" style={{ color: "var(--success)" }}>
            {confirmacion}
          </span>
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-4" noValidate>
          <div>
            <label className="label" htmlFor="email">
              Correo de la cuenta
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
            disabled={isSubmitting}
            className="btn btn-primary w-full justify-center"
            style={{ padding: "12px 16px", fontSize: 14 }}
          >
            {isSubmitting ? (
              <>
                <Loader2 size={15} strokeWidth={2} className="animate-spin" />
                Enviando…
              </>
            ) : (
              "Enviar enlace"
            )}
          </button>
        </form>
      )}

      <div className="my-8" style={{ height: 1, background: "var(--border-hex)" }} />

      <Link
        to="/login"
        className="flex items-center justify-center gap-1.5 text-[12.5px] font-medium hover:underline"
        style={{ color: "var(--brand)" }}
      >
        <ArrowLeft size={13} /> Volver al inicio de sesión
      </Link>
    </AuthLayout>
  );
}
