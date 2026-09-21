import { useState } from "react";
import { Moon, Plus, Sun } from "lucide-react";
import { Badge } from "@/core/components/ui/badge";
import { Button } from "@/core/components/ui/button";
import { Input } from "@/core/components/ui/input";
import { Panel } from "@/core/components/ui/panel";
import { ApiError } from "@/core/lib/apiClient";
import { useThemeStore } from "@/core/store/themeStore";
import { useCiclos } from "@/features/ciclos/hooks/useCiclos";
import { useCrearCiclo } from "@/features/ciclos/hooks/useCrearCiclo";
import { useMarcarCicloActivo } from "@/features/ciclos/hooks/useMarcarCicloActivo";

export default function ConfiguracionPage() {
  const { data: ciclos, isLoading } = useCiclos();
  const crearCiclo = useCrearCiclo();
  const marcarActivo = useMarcarCicloActivo();
  const [nuevoAnio, setNuevoAnio] = useState("");
  const { tema, alternarTema } = useThemeStore();

  const onCrear = () => {
    const anio = Number(nuevoAnio);
    if (!Number.isInteger(anio) || anio < 2000) return;
    crearCiclo.mutate({ anio }, { onSuccess: () => setNuevoAnio("") });
  };

  return (
    <div className="space-y-4">
      <Panel title="Apariencia">
        <div className="space-y-3 p-5">
          <p className="text-[12.5px] text-muted-foreground">
            Elegí cómo se ve el sistema en este dispositivo. La preferencia se guarda en el navegador.
          </p>
          <div className="flex items-center gap-2">
            {(
              [
                { valor: "light" as const, label: "Claro", icon: Sun },
                { valor: "dark" as const, label: "Oscuro", icon: Moon },
              ]
            ).map(({ valor, label, icon: Icon }) => (
              <button
                key={valor}
                onClick={() => {
                  if (tema !== valor) alternarTema();
                }}
                className="flex items-center gap-1.5 rounded px-3 py-1.5 text-[12.5px] font-medium transition-all"
                style={{
                  background: tema === valor ? "var(--brand)" : "var(--bg)",
                  color: tema === valor ? "#fff" : "var(--text)",
                  border: `1px solid ${tema === valor ? "var(--brand)" : "var(--border-hex)"}`,
                }}
              >
                <Icon size={14} /> {label}
              </button>
            ))}
          </div>
        </div>
      </Panel>

      <Panel title="Ciclos lectivos">
        <div className="space-y-3 p-5">
          <p className="text-[12.5px] text-muted-foreground">
            El ciclo activo es el que se asigna por defecto a los cursos y alumnos que se dan de alta hoy. Los ciclos
            anteriores quedan como historial, no se pueden reactivar cursos viejos, solo consultarlos.
          </p>

          {isLoading && <p className="text-sm text-muted-foreground">Cargando…</p>}
          {ciclos?.map((ciclo) => (
            <div key={ciclo.id} className="flex items-center justify-between gap-3 rounded-md border p-3" style={{ borderColor: "var(--border-hex)" }}>
              <div className="flex items-center gap-2.5">
                <span className="tnum text-[15px] font-semibold">{ciclo.anio}</span>
                {ciclo.activo ? (
                  <Badge variant="success">Activo</Badge>
                ) : (
                  <Badge variant="neutral">Histórico</Badge>
                )}
              </div>
              {!ciclo.activo && (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={marcarActivo.isPending}
                  onClick={() => marcarActivo.mutate(ciclo.id)}
                >
                  Marcar como activo
                </Button>
              )}
            </div>
          ))}

          <div className="flex items-end gap-2 border-t pt-4" style={{ borderColor: "var(--border-hex)" }}>
            <div className="flex-1 space-y-1.5">
              <label className="label">Nuevo ciclo (año)</label>
              <Input
                type="number"
                value={nuevoAnio}
                onChange={(e) => setNuevoAnio(e.target.value)}
                placeholder="Ej: 2027"
              />
            </div>
            <Button onClick={onCrear} disabled={crearCiclo.isPending || !nuevoAnio}>
              <Plus className="mr-1.5" size={14} /> Crear
            </Button>
          </div>
          {crearCiclo.isError && (
            <p className="text-sm text-destructive">
              {crearCiclo.error instanceof ApiError ? crearCiclo.error.message : "No se pudo crear el ciclo"}
            </p>
          )}
          {marcarActivo.isError && (
            <p className="text-sm text-destructive">
              {marcarActivo.error instanceof ApiError ? marcarActivo.error.message : "No se pudo activar el ciclo"}
            </p>
          )}
        </div>
      </Panel>
    </div>
  );
}
