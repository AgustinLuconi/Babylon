import { Panel } from "@/core/components/ui/panel";
import { Interruptor } from "@/core/components/ui/interruptor";
import { useCambiarPreferencia } from "@/features/notificaciones/hooks/useCambiarPreferencia";
import { usePreferenciasNotificaciones } from "@/features/notificaciones/hooks/usePreferenciasNotificaciones";

// Qué avisos aparecen en la campana, para el rol con el que se entró (cada rol de una cuenta se configura aparte).
// Apagar un tipo no oculta la información: sigue en su pantalla.
export function PreferenciasNotificaciones() {
  const { data: preferencias, isLoading, isError } = usePreferenciasNotificaciones();
  const cambiar = useCambiarPreferencia();

  return (
    <Panel title="Notificaciones">
      <div className="space-y-3 p-5">
        <p className="text-[12.5px] text-muted-foreground">
          Elegí qué avisos aparecen en la campana. Lo que apagues sigue disponible en su pantalla.
        </p>
        {isLoading && <p className="text-sm text-muted-foreground">Cargando…</p>}
        {isError && (
          <p role="alert" className="text-[12.5px] text-destructive">
            No se pudieron cargar tus preferencias. Probá de nuevo en unos minutos.
          </p>
        )}
        {cambiar.isError && (
          <p role="alert" className="text-[12.5px] text-destructive">
            No se pudo guardar el cambio. Probá de nuevo.
          </p>
        )}
        <ul className="divide-y" style={{ borderColor: "var(--border-hex)" }}>
          {preferencias?.map((p) => (
            <li key={p.tipo} data-preferencia className="flex items-center justify-between gap-4 py-2.5">
              <span className="min-w-0 text-[13px]">{p.etiqueta}</span>
              <Interruptor
                activo={p.activa}
                etiqueta={p.etiqueta}
                deshabilitado={cambiar.isPending}
                onClick={() => cambiar.mutate({ tipo: p.tipo, activa: !p.activa })}
              />
            </li>
          ))}
        </ul>
      </div>
    </Panel>
  );
}
