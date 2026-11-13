import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/core/components/ui/input";

interface Props {
  id: string;
  valor: string;
  onCambiar: (valor: string) => void;
  error?: string;
  ayuda?: string;
  placeholder?: string;
}

// La contraseña que escribe el administrador (con el ojito para verla). No hay botón de generar: la elige él.
export function CampoPassword({ id, valor, onCambiar, error, ayuda, placeholder }: Props) {
  const [mostrar, setMostrar] = useState(false);
  return (
    <div className="space-y-1.5">
      <div className="relative">
        <Input
          id={id}
          type={mostrar ? "text" : "password"}
          autoComplete="new-password"
          value={valor}
          onChange={(e) => onCambiar(e.target.value)}
          placeholder={placeholder}
          className="pr-9"
          aria-invalid={error ? true : undefined}
        />
        <button
          type="button"
          onClick={() => setMostrar((v) => !v)}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:bg-accent"
          aria-label={mostrar ? "Ocultar contraseña" : "Mostrar contraseña"}
        >
          {mostrar ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
      </div>
      {ayuda && !error && <p className="text-[11.5px] text-muted-foreground">{ayuda}</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
