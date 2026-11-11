import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Button } from "@/core/components/ui/button";
import { Input } from "@/core/components/ui/input";
import { normalizarTexto } from "@/core/lib/utils";
import { useSinCuenta } from "../hooks/useSinCuenta";
import type { FilaSinCuenta } from "../types";

const TIPO: Record<FilaSinCuenta["tipo"], string> = { padre: "Responsable", profesor: "Profesor" };

// Los responsables y profesores que todavía no tienen cuenta: el administrador les crea una desde acá (con el email de la ficha
// ya completado, si lo hay).
export function SinCuentaTab({ onCrearCuenta }: { onCrearCuenta: (ficha: FilaSinCuenta) => void }) {
  const { data: filas, isLoading } = useSinCuenta();
  const [busqueda, setBusqueda] = useState("");
  const visibles = useMemo(() => {
    const q = normalizarTexto(busqueda);
    return (filas ?? []).filter((f) => !q || normalizarTexto(`${f.nombre} ${f.email ?? ""}`).includes(q));
  }, [filas, busqueda]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[13px]" style={{ color: "var(--text-muted)" }}>
          <span className="font-medium" style={{ color: "var(--text)" }}>
            {filas?.length ?? 0}
          </span>{" "}
          {filas?.length === 1 ? "persona sin cuenta" : "personas sin cuenta"}
        </p>
        <div className="relative w-full max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar por nombre o email…" className="pl-8" aria-label="Buscar sin cuenta" />
        </div>
      </div>
      <div className="card-hl overflow-x-auto">
        <table className="tbl">
          <thead>
            <tr>
              <th>Persona</th>
              <th>Tipo</th>
              <th>Email de la ficha</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={4} className="h-20 text-center text-muted-foreground">
                  Cargando…
                </td>
              </tr>
            )}
            {!isLoading && visibles.length === 0 && (
              <tr>
                <td colSpan={4} className="h-20 text-center text-muted-foreground">
                  {(filas ?? []).length === 0 ? "Todos los responsables y profesores tienen cuenta." : "Sin resultados."}
                </td>
              </tr>
            )}
            {visibles.map((f) => (
              <tr key={f.clave} data-sin-cuenta={f.clave}>
                <td className="font-medium">{f.nombre}</td>
                <td>{TIPO[f.tipo]}</td>
                <td className="font-mono text-[12px]" style={{ color: f.email ? "var(--text-muted)" : "var(--text-faint)" }}>
                  {f.email ?? "sin email"}
                </td>
                <td className="text-right">
                  <Button size="sm" variant="outline" data-crear-cuenta-de={f.clave} onClick={() => onCrearCuenta(f)}>
                    Crear cuenta
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
