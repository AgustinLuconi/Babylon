import { useAuth } from "@/features/auth/hooks/useAuth";
import { useChatsNoLeidos } from "@/features/chats/hooks/useChatsNoLeidos";

// Número del menú lateral: conversaciones con mensajes sin leer (instituto) o mensajes sin leer (padre).
export function ContadorChats() {
  const { usuario } = useAuth();
  const habilitado = usuario?.rol === "admin" || usuario?.rol === "secretario" || usuario?.rol === "padre";
  const { data } = useChatsNoLeidos(habilitado);
  const n = (usuario?.rol === "padre" ? data?.mensajes : data?.conversaciones) ?? 0;
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
