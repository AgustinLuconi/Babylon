import { Navigate } from "react-router-dom";
import { useAuth } from "@/features/auth/hooks/useAuth";
import AdminDashboard from "./AdminDashboard";
import SecretarioDashboard from "./SecretarioDashboard";

export default function DashboardPage() {
  const { usuario } = useAuth();

  switch (usuario?.rol) {
    case "admin":
      return <AdminDashboard />;
    case "secretario":
      return <SecretarioDashboard />;
    // Profesor y padre no tienen una pantalla de "resumen" propia en el
    // prototipo — su primer ítem de nav ya ES su pantalla principal
    // ("Mis cursos" / "Resumen" dentro de ParentDashboardPage).
    case "profesor":
      return <Navigate to="/cursos" replace />;
    case "padre":
      return <Navigate to="/mis-hijos" replace />;
    default:
      return null;
  }
}
