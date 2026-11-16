import { Panel } from "@/core/components/ui/panel";
import { useAutomatizaciones } from "../hooks/useAutomatizaciones";
import { TarjetaDeRegla } from "./TarjetaDeRegla";

// Configuración → Automatizaciones (solo administración): las reglas automáticas del sistema y su historial.
export function PanelAutomatizaciones() {
  const { data: reglas, isLoading, isError } = useAutomatizaciones();
  return (
    <Panel title="Automatizaciones">
      <div className="space-y-3 p-5">
        <p className="text-[12.5px] text-muted-foreground">
          Avisos automáticos para el equipo del instituto. Cada regla se revisa sola cuando cambian los datos y todas las noches; apagarla cierra sus
          alertas y cambiar el número las recalcula en el momento.
        </p>
        {isLoading && <p className="text-sm text-muted-foreground">Cargando…</p>}
        {isError && <p className="text-sm text-destructive">No se pudieron cargar las automatizaciones</p>}
        {reglas?.map((regla) => <TarjetaDeRegla key={regla.id} regla={regla} />)}
      </div>
    </Panel>
  );
}
