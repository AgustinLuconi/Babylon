import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Loader2 } from "lucide-react";
import { ApiError } from "@/core/lib/apiClient";
import { useSessionStore } from "@/core/store/sessionStore";
import { authService } from "../authService";
import { AuthLayout } from "../components/AuthLayout";
import { AvisoError } from "../components/AvisoError";

const ENLACE_NO_VALIDO = "El enlace no es válido o ya venció.";

export default function VerificarEmailPage() {
  const [params] = useSearchParams();
  const [token] = useState(() => params.get("token") ?? "");
  const [estado, setEstado] = useState<"verificando" | "listo" | "error">(token ? "verificando" : "error");
  const [mensaje, setMensaje] = useState(ENLACE_NO_VALIDO);
  const conSesion = useSessionStore((s) => !!s.token);
  const queryClient = useQueryClient();
  const iniciado = useRef(false);

  useEffect(() => {
    if (params.has("token")) window.history.replaceState(null, "", "/verificar-email");
  }, [params]);

  useEffect(() => {
    // Un solo intento: el enlace sirve una vez (y en desarrollo React ejecuta los efectos dos veces).
    if (!token || iniciado.current) return;
    iniciado.current = true;
    authService.verificarEmail(token).then(
      () => {
        setEstado("listo");
        void queryClient.invalidateQueries({ queryKey: ["yo"] });
      },
      (e) => {
        setMensaje(e instanceof ApiError ? e.message : "No se pudo verificar el email. Probá de nuevo.");
        setEstado("error");
      },
    );
  }, [token, queryClient]);

  const destino = conSesion ? { to: "/mi-cuenta", texto: "Ir a Mi cuenta" } : { to: "/login", texto: "Ir al inicio de sesión" };

  return (
    <AuthLayout>
      <meta name="referrer" content="no-referrer" />
      <p className="eyebrow mb-3">Verificar email</p>
      {estado === "verificando" && (
        <p className="flex items-center gap-2 text-[14px]" style={{ color: "var(--text-muted)" }}>
          <Loader2 size={15} className="animate-spin" /> Verificando tu email…
        </p>
      )}
      {estado === "listo" && (
        <div role="status" className="flex items-start gap-2.5">
          <CheckCircle2 size={20} style={{ color: "var(--success)", flexShrink: 0, marginTop: 3 }} />
          <h2 style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-0.02em", color: "var(--text)" }}>Listo, tu email quedó verificado.</h2>
        </div>
      )}
      {estado === "error" && (
        <div className="space-y-3">
          <AvisoError>{mensaje}</AvisoError>
          <p className="text-[13px]" style={{ color: "var(--text-muted)" }}>
            Pedí uno nuevo desde Mi cuenta.
          </p>
        </div>
      )}
      <div className="my-8" style={{ height: 1, background: "var(--border-hex)" }} />
      <Link to={destino.to} className="text-[12.5px] font-medium hover:underline" style={{ color: "var(--brand)" }}>
        {destino.texto}
      </Link>
    </AuthLayout>
  );
}
