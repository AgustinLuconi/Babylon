import { Navigate, Outlet } from "react-router-dom";
import { useSessionStore } from "@/core/store/sessionStore";
import type { Rol } from "@/features/auth/types";

interface ProtectedRouteProps {
  rolesPermitidos?: Rol[];
}

export function ProtectedRoute({ rolesPermitidos }: ProtectedRouteProps) {
  const token = useSessionStore((s) => s.token);
  const usuario = useSessionStore((s) => s.usuario);

  if (!token || !usuario) {
    return <Navigate to="/login" replace />;
  }

  if (rolesPermitidos && !rolesPermitidos.includes(usuario.rol)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}
