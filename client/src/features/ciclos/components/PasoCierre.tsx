export interface Cierre {
  activarDestino: boolean;
  bloquearOrigen: boolean;
}

export interface PasoCierreProps {
  origenAnio: number;
  destinoAnio: number;
  cierre: Cierre;
  onCierre: (cierre: Cierre) => void;
}

// Paso 5 (opcional): cerrar el año en la misma operación. Bloquear el origen exige activar antes el destino.
export function PasoCierre({ origenAnio, destinoAnio, cierre, onCierre }: PasoCierreProps) {
  return (
    <div className="space-y-3 text-sm">
      <p className="text-[12.5px] text-muted-foreground">
        Si lo dejás marcado, al confirmar también se cierra el año: todo ocurre junto o no ocurre nada.
      </p>
      <label className="flex items-center gap-2.5">
        <input type="checkbox" checked={cierre.activarDestino} onChange={(e) => onCierre({ activarDestino: e.target.checked, bloquearOrigen: e.target.checked && cierre.bloquearOrigen })} />
        Activar el ciclo {destinoAnio}
      </label>
      <label className="flex items-center gap-2.5">
        <input
          type="checkbox"
          checked={cierre.bloquearOrigen}
          disabled={!cierre.activarDestino}
          onChange={(e) => onCierre({ ...cierre, bloquearOrigen: e.target.checked })}
        />
        Bloquear el ciclo {origenAnio} (queda tal como está, sin cambios)
      </label>
    </div>
  );
}
