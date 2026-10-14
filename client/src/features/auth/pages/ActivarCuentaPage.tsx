import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, Loader2 } from "lucide-react";
import { ApiError } from "@/core/lib/apiClient";
import { passwordNueva } from "@/core/lib/validacion";
import { authService } from "../authService";
import { AuthLayout } from "../components/AuthLayout";
import { AvisoError } from "../components/AvisoError";
import { CampoContrasena } from "../components/CampoContrasena";

const ENLACE_NO_VALIDO = "El enlace no es válido o ya venció.";

const schema = z
  .object({ password: passwordNueva, repetir: z.string() })
  .refine((d) => d.password === d.repetir, { path: ["repetir"], message: "Las contraseñas no coinciden" });
type Formulario = z.infer<typeof schema>;

export default function ActivarCuentaPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  // Se lee una sola vez y se quita de la barra de direcciones, para que el token no quede en el historial.
  const [token] = useState(() => params.get("token") ?? "");
  useEffect(() => {
    if (params.has("token")) window.history.replaceState(null, "", "/activar-cuenta");
  }, [params]);

  const invitacion = useQuery({
    queryKey: ["invitacion", token],
    queryFn: () => authService.consultarInvitacion(token),
    enabled: !!token,
    retry: false,
    staleTime: Infinity,
  });
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Formulario>({ resolver: zodResolver(schema) });
  const [error, setError] = useState<string | null>(null);
  // El server rechazó el enlace al activar (venció, se reenvió otra invitación, ya se usó).
  const [rechazadoAlActivar, setRechazadoAlActivar] = useState(false);

  const onSubmit = async ({ password }: Formulario) => {
    setError(null);
    try {
      await authService.activarCuenta(token, password);
      navigate("/login?motivo=cuenta-activada", { replace: true });
    } catch (e) {
      if (e instanceof ApiError && e.status === 400 && e.message === ENLACE_NO_VALIDO) setRechazadoAlActivar(true);
      setError(e instanceof ApiError ? e.message : "No se pudo activar la cuenta. Probá de nuevo.");
    }
  };

  // Enlace realmente inválido: sin enlace, o el server dijo 400. Un 429 o un error de red no dicen nada del enlace.
  const falloLaConsulta = invitacion.isError;
  const enlaceRechazado = invitacion.error instanceof ApiError && invitacion.error.status === 400;
  const invalido = !token || (falloLaConsulta && enlaceRechazado) || rechazadoAlActivar;
  const noSePudoComprobar = !!token && falloLaConsulta && !enlaceRechazado;

  return (
    <AuthLayout>
      {/* El enlace lleva el token: que no se filtre a otros sitios como referrer. */}
      <meta name="referrer" content="no-referrer" />
      <p className="eyebrow mb-3">Activar cuenta</p>
      <h2 style={{ fontSize: 26, fontWeight: 600, letterSpacing: "-0.02em", lineHeight: 1.15, color: "var(--text)" }}>
        {invitacion.data ? `Hola ${invitacion.data.nombre}, elegí tu contraseña` : "Activá tu cuenta"}
      </h2>
      {invitacion.data && (
        <p className="mt-2 text-[13.5px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
          Vas a ingresar con <span className="font-mono">{invitacion.data.email}</span>.
        </p>
      )}
      {invitacion.isLoading && (
        <p className="mt-6 flex items-center gap-2 text-[13px]" style={{ color: "var(--text-muted)" }}>
          <Loader2 size={14} className="animate-spin" /> Revisando el enlace…
        </p>
      )}

      {invitacion.data && !rechazadoAlActivar && (
        <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-4" noValidate>
          <CampoContrasena id="password" etiqueta="Contraseña" autoComplete="new-password" error={errors.password?.message} {...register("password")} />
          <CampoContrasena id="repetir" etiqueta="Repetir contraseña" autoComplete="new-password" error={errors.repetir?.message} {...register("repetir")} />
          {error && <AvisoError>{error}</AvisoError>}
          <button type="submit" disabled={isSubmitting} className="btn btn-primary w-full justify-center" style={{ padding: "12px 16px", fontSize: 14 }}>
            {isSubmitting ? (
              <>
                <Loader2 size={15} strokeWidth={2} className="animate-spin" />
                Activando…
              </>
            ) : (
              "Activar mi cuenta"
            )}
          </button>
        </form>
      )}

      {noSePudoComprobar && (
        <div className="mt-8">
          <AvisoError>No se pudo comprobar el enlace. Probá de nuevo en unos minutos.</AvisoError>
        </div>
      )}

      {invalido && (
        <div className="mt-8 space-y-3">
          <AvisoError>{ENLACE_NO_VALIDO}</AvisoError>
          <p className="text-[13px]" style={{ color: "var(--text-muted)" }}>
            Ingresá tu email en{" "}
            <Link to="/olvide-contrasena" className="font-medium hover:underline" style={{ color: "var(--brand)" }}>
              ¿Olvidaste tu contraseña?
            </Link>{" "}
            y te enviamos una invitación nueva.
          </p>
        </div>
      )}

      <div className="my-8" style={{ height: 1, background: "var(--border-hex)" }} />
      <Link to="/login" className="flex items-center gap-1.5 text-[12.5px] font-medium hover:underline" style={{ color: "var(--brand)" }}>
        <ArrowLeft size={13} /> Volver al inicio de sesión
      </Link>
    </AuthLayout>
  );
}
