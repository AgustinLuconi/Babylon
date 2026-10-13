import { Button } from "@/core/components/ui/button";
import { ApiError } from "@/core/lib/apiClient";
import { useEnviarVerificacion } from "../hooks/useEnviarVerificacion";
import { useYo } from "../hooks/useYo";

// Aviso de Mi cuenta mientras el email no esté verificado. No bloquea nada: solo ofrece mandar el enlace.
export function EmailSinVerificar() {
  const { data: yo } = useYo();
  const enviar = useEnviarVerificacion();
  if (!yo || yo.emailVerificado) return null;

  return (
    <div
      className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
      style={{ background: "var(--warning-soft)", border: "1px solid var(--warning)", borderRadius: 4 }}
    >
      <div className="min-w-0">
        <p className="text-[13px] font-medium" style={{ color: "var(--text)" }}>
          Tu email no está verificado
        </p>
        {enviar.isSuccess ? (
          <p role="status" className="mt-0.5 text-[12.5px]" style={{ color: "var(--text)" }}>
            Te enviamos un enlace a {yo.email}. Vence en 24 horas.
          </p>
        ) : (
          <p className="mt-0.5 text-[12.5px]" style={{ color: "var(--text-muted)" }}>
            Te mandamos un enlace a {yo.email} para confirmar que es tuyo.
          </p>
        )}
        {enviar.isError && (
          <p role="alert" className="mt-0.5 text-[12.5px] text-destructive">
            {enviar.error instanceof ApiError ? enviar.error.message : "No se pudo enviar el enlace"}
          </p>
        )}
      </div>
      <Button variant="outline" size="sm" disabled={enviar.isPending} onClick={() => enviar.mutate()}>
        {enviar.isPending ? "Enviando…" : "Enviar enlace de verificación"}
      </Button>
    </div>
  );
}
