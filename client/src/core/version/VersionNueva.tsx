import { useEffect } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/core/components/ui/button";
import { escucharSenal } from "@/core/tiempoReal/senales";
import { comprobarVersion, recargar, useVersionStore } from "./version";

const CADA_MS = 10 * 60 * 1000;

// Comprueba la versión al (re)conectarse la conexión en vivo (un despliegue la corta) y cada 10 minutos. Muestra la
// franja (deja terminar) y, después de guardar algo, el cartel que exige recargar.
export function VersionNueva() {
  const { estado, bloqueo } = useVersionStore();

  useEffect(() => {
    const dejar = escucharSenal("listo", ({ datos }) => {
      void comprobarVersion((datos as { version?: string } | undefined)?.version);
    });
    const intervalo = window.setInterval(() => void comprobarVersion(), CADA_MS);
    return () => {
      dejar();
      window.clearInterval(intervalo);
    };
  }, []);

  if (estado !== "nueva") return null;
  if (bloqueo) {
    return (
      <div role="alertdialog" aria-modal="true" className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4">
        <div className="card-hl w-full max-w-sm bg-background p-5 shadow-lg">
          <p className="text-[15px] font-semibold">Recargá para seguir</p>
          <p className="mt-2 text-[13px]">Hay una versión nueva del sistema. Para seguir usándolo sin errores, recargá la página.</p>
          <p className="mt-1 text-[12.5px] text-muted-foreground">Lo que hiciste quedó guardado.</p>
          <Button autoFocus className="mt-4 w-full justify-center" onClick={recargar}>
            Recargar
          </Button>
        </div>
      </div>
    );
  }
  return (
    <div
      role="status"
      className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 text-[13px]"
      style={{ background: "var(--warning-soft)", borderBottom: "1px solid var(--warning)" }}
    >
      <span>
        <b>Hay una versión nueva del sistema.</b> Guardá lo que estés haciendo y después recargá la página para evitar errores.
      </span>
      <Button size="sm" variant="outline" onClick={recargar}>
        <RefreshCw size={13} /> Recargar ahora
      </Button>
    </div>
  );
}
