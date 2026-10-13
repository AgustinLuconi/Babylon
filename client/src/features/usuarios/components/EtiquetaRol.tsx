import { ROL_LABELS, type Rol } from "@/features/auth/types";

// Colores de la etiqueta de rol, calcados de ROLE_LABELS del prototipo.
const ESTILO_ROL: Record<Rol, { color: string; bg: string; dot: string }> = {
  admin: { color: "#09090B", bg: "#F4F4F5", dot: "#0F3D2E" },
  secretario: { color: "#09090B", bg: "#F4F4F5", dot: "#71717A" },
  profesor: { color: "#0F3D2E", bg: "#F0F4F2", dot: "#1B7A4F" },
  padre: { color: "#52525B", bg: "#FAFAFA", dot: "#A1A1AA" },
};

export function EtiquetaRol({ rol, compacta = false }: { rol: Rol; compacta?: boolean }) {
  const estilo = ESTILO_ROL[rol];
  return (
    <span
      className={`inline-flex shrink-0 items-center font-medium ${
        compacta ? "gap-1 px-2 py-0.5 text-[11px]" : "gap-1.5 px-2 py-0.5 text-[11.5px]"
      }`}
      style={{ background: estilo.bg, color: estilo.color, borderRadius: 2 }}
    >
      <span className={`rounded-full ${compacta ? "h-1 w-1" : "h-1.5 w-1.5"}`} style={{ background: estilo.dot }} />
      {ROL_LABELS[rol]}
    </span>
  );
}
