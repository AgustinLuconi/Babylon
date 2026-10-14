import { useState, type ComponentProps } from "react";
import { Eye, EyeOff, Lock } from "lucide-react";

type Props = ComponentProps<"input"> & { id: string; etiqueta: string; error?: string };

// Campo de contraseña de las pantallas públicas de acceso, con el botón para mostrarla. Acepta lo que devuelve
// `register()` de react-hook-form (incluida la ref).
export function CampoContrasena({ id, etiqueta, error, ...props }: Props) {
  const [mostrar, setMostrar] = useState(false);
  return (
    <div>
      <label className="label" htmlFor={id}>
        {etiqueta}
      </label>
      <div className="relative">
        <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-faint)" }} />
        <input
          id={id}
          type={mostrar ? "text" : "password"}
          placeholder="••••••••"
          className="input"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          style={{ paddingLeft: 34, paddingRight: 36, paddingTop: 10, paddingBottom: 10 }}
          {...props}
        />
        <button
          type="button"
          onClick={() => setMostrar((v) => !v)}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 hover:bg-zinc-100"
          style={{ color: "var(--text-muted)" }}
          aria-label={mostrar ? "Ocultar contraseña" : "Mostrar contraseña"}
        >
          {mostrar ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
      </div>
      {error && (
        <p id={`${id}-error`} className="mt-1.5 text-[12px] text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
