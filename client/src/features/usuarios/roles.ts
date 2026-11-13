import type { Rol } from "@/features/auth/types";

export const DESCRIPCION_ROL: Record<Rol, string> = {
  admin: "Acceso total al sistema, incluyendo configuración y datos sensibles.",
  secretario: "Puede gestionar legajos y registrar pagos. Sin acceso a reportes ni configuración.",
  profesor: "Accede solo a sus cursos asignados. No ve información de pagos.",
  padre: "Ve la información de sus hijos o de su propia cursada. Solo lo suyo.",
};
export const ORDEN_ROLES: Rol[] = ["admin", "secretario", "profesor", "padre"];
