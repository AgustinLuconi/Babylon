export function Interruptor({
  activo,
  onClick,
  deshabilitado,
  titulo,
  etiqueta,
}: {
  activo: boolean;
  onClick: () => void;
  deshabilitado?: boolean;
  titulo?: string;
  // Nombre accesible cuando no hay un texto visible asociado al interruptor.
  etiqueta?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={activo}
      aria-label={etiqueta}
      title={titulo}
      disabled={deshabilitado}
      onClick={onClick}
      className="relative inline-flex items-center disabled:cursor-not-allowed disabled:opacity-60"
      style={{
        width: 30,
        height: 18,
        background: activo ? "var(--brand)" : "var(--border-strong)",
        borderRadius: 999,
        transition: "background 150ms ease",
      }}
    >
      <span
        className="absolute"
        style={{
          width: 12,
          height: 12,
          background: "#fff",
          borderRadius: 999,
          left: activo ? 15 : 3,
          transition: "left 150ms ease",
        }}
      />
    </button>
  );
}
