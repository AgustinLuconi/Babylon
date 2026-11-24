import { useNotificaciones } from "@/features/notificaciones/hooks/useNotificaciones";

// Número del menú lateral: avisos sin leer de la cuenta en su rol. Es la misma consulta que la campana (una sola caché), así que
// los dos números cambian a la vez con las señales en vivo.
export function ContadorNotificaciones() {
  const { data } = useNotificaciones();
  const n = data?.noLeidas ?? 0;
  if (n === 0) return null;
  return (
    <span
      data-contador-menu
      className="min-w-4 rounded-full px-1.5 text-center text-[10px] font-semibold leading-4 text-white"
      style={{ background: "var(--danger)" }}
    >
      {n > 9 ? "9+" : n}
    </span>
  );
}
