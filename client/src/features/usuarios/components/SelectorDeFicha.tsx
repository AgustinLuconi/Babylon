import { Input } from "@/core/components/ui/input";
import { Select } from "@/core/components/ui/select";
import { FICHA_NUEVA_VACIA, type FichaElegida } from "../fichas";
import type { FilaSinCuenta } from "../types";

interface Props {
  tipo: "padre" | "profesor";
  valor: FichaElegida;
  onCambiar: (valor: FichaElegida) => void;
  // Las fichas de ese tipo que todavía no tienen cuenta.
  fichas: FilaSinCuenta[];
  errores: Record<string, string>;
}

function Error({ mensaje }: { mensaje?: string }) {
  return mensaje ? <p className="text-sm text-destructive">{mensaje}</p> : null;
}

// Para un rol atado a una ficha (responsable o profesor): elegir una que ya existe y no tiene cuenta, o cargar una nueva.
export function SelectorDeFicha({ tipo, valor, onCambiar, fichas, errores }: Props) {
  const etiqueta = tipo === "padre" ? "responsable" : "profesor";
  const nueva = valor.modo === "nueva" ? valor : { ...FICHA_NUEVA_VACIA };
  const cambiar = (campo: "nombre" | "apellido" | "telefono" | "dni", texto: string) => onCambiar({ ...nueva, [campo]: texto } as FichaElegida);
  return (
    <div className="space-y-3 rounded-md border p-3" style={{ borderColor: "var(--border-hex)" }}>
      <p className="text-[12px] font-medium">Ficha de {etiqueta}</p>
      <div className="flex gap-1.5" role="group" aria-label={`Ficha de ${etiqueta}`}>
        {(
          [
            ["existente", "Una que ya existe"],
            ["nueva", "Ficha nueva"],
          ] as const
        ).map(([modo, texto]) => (
          <button
            key={modo}
            type="button"
            data-ficha-modo={modo}
            aria-pressed={valor.modo === modo}
            onClick={() => onCambiar(modo === "existente" ? { modo: "existente", fichaId: "" } : { ...FICHA_NUEVA_VACIA })}
            className="px-3 py-1.5 text-[12px] font-medium"
            style={{
              border: `1px solid ${valor.modo === modo ? "var(--brand)" : "var(--border-hex)"}`,
              background: valor.modo === modo ? "var(--brand-soft)" : "var(--bg)",
              color: valor.modo === modo ? "var(--brand)" : "var(--text)",
              borderRadius: 4,
            }}
          >
            {texto}
          </button>
        ))}
      </div>
      {valor.modo === "existente" ? (
        <div className="space-y-1.5">
          <Select data-ficha-select value={valor.fichaId} onChange={(e) => onCambiar({ modo: "existente", fichaId: e.target.value })}>
            <option value="">{fichas.length === 0 ? `No hay ${etiqueta}s sin cuenta` : "Elegí una ficha…"}</option>
            {fichas.map((f) => (
              <option key={f.fichaId} value={f.fichaId}>
                {f.nombre}
                {f.email ? ` · ${f.email}` : ""}
              </option>
            ))}
          </Select>
          <Error mensaje={errores.ficha} />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="label">Nombre</label>
            <Input value={nueva.nombre} onChange={(e) => cambiar("nombre", e.target.value)} />
            <Error mensaje={errores.nombre} />
          </div>
          <div className="space-y-1.5">
            <label className="label">Apellido</label>
            <Input value={nueva.apellido} onChange={(e) => cambiar("apellido", e.target.value)} />
            <Error mensaje={errores.apellido} />
          </div>
          {tipo === "profesor" && (
            <div className="space-y-1.5">
              <label className="label">DNI</label>
              <Input className="font-mono" value={nueva.dni} onChange={(e) => cambiar("dni", e.target.value)} />
              <Error mensaje={errores.dni} />
            </div>
          )}
          <div className={`space-y-1.5 ${tipo === "padre" ? "col-span-2" : ""}`}>
            <label className="label">{tipo === "padre" ? "Celular (WhatsApp)" : "Teléfono · opcional"}</label>
            <Input value={nueva.telefono} placeholder="351 555-1234" onChange={(e) => cambiar("telefono", e.target.value)} />
            <Error mensaje={errores.telefono} />
          </div>
        </div>
      )}
    </div>
  );
}
