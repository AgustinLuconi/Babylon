import { Button } from "@/core/components/ui/button";
import { useSinGuardarStore } from "./sinGuardar";

// La pregunta antes de descartar lo que no se guardó. Va por encima de cualquier modal.
export function ConfirmarSalida() {
  const pregunta = useSinGuardarStore((e) => e.pregunta);
  if (!pregunta) return null;
  return (
    <div role="alertdialog" aria-modal="true" className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
      <div className="card-hl w-full max-w-sm bg-background p-5 shadow-lg">
        <p className="text-[14px] font-semibold">Tenés cambios sin guardar. ¿Salir igual?</p>
        <div className="mt-4 flex gap-2">
          <Button autoFocus variant="outline" className="flex-1" onClick={() => pregunta(false)}>
            Seguir editando
          </Button>
          <Button variant="destructive" className="flex-1" onClick={() => pregunta(true)}>
            Salir sin guardar
          </Button>
        </div>
      </div>
    </div>
  );
}
