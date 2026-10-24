import type { Rol } from "@/features/auth/types";

const AREA: Record<Rol, string> = {
  admin: "Administración",
  secretario: "Secretaría",
  profesor: "Docente",
  padre: "Familia",
};

// Quién escribió una observación y desde qué lugar del instituto: "Lucía Peralta · Secretaría".
export function etiquetaDeAutor(nombre: string, rol: Rol): string {
  return `${nombre} · ${AREA[rol]}`;
}
