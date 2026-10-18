// Botón al principio de la conversación para cargar la página anterior de mensajes.
export function VerAnteriores({ hay, cargando, onCargar }: { hay: boolean; cargando: boolean; onCargar: () => void }) {
  if (!hay) return null;
  return (
    <div className="flex justify-center">
      <button
        onClick={onCargar}
        disabled={cargando}
        className="rounded px-3 py-1 text-[11.5px] text-muted-foreground hover:bg-accent disabled:opacity-60"
      >
        {cargando ? "Cargando…" : "Ver mensajes anteriores"}
      </button>
    </div>
  );
}
