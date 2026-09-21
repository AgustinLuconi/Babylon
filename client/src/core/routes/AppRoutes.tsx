import { Navigate, Route, Routes } from "react-router-dom";
import { AppLayout } from "@/core/components/layout/AppLayout";
import LoginPage from "@/features/auth/pages/LoginPage";
import DashboardPage from "@/features/dashboard/pages/DashboardPage";
import AlumnosListPage from "@/features/alumnos/pages/AlumnosListPage";
import AlumnoDetailPage from "@/features/alumnos/pages/AlumnoDetailPage";
import InscribirAlumnoPage from "@/features/alumnos/pages/InscribirAlumnoPage";
import CuotasPage from "@/features/cuotas/pages/CuotasPage";
import MisCursosPage from "@/features/cursos/pages/MisCursosPage";
import AsistenciaProfesorPage from "@/features/asistencia/pages/AsistenciaProfesorPage";
import CalificacionesProfesorPage from "@/features/calificaciones/pages/CalificacionesProfesorPage";
import ObservacionesProfesorPage from "@/features/observaciones/pages/ObservacionesProfesorPage";
import ParentDashboardPage from "@/features/alumnos/pages/ParentDashboardPage";
import ChatPage from "@/features/chats/pages/ChatPage";
import ChatsAdminPage from "@/features/chats/pages/ChatsAdminPage";
import CursosAdminPage from "@/features/cursos/pages/CursosAdminPage";
import UsuariosPage from "@/features/usuarios/pages/UsuariosPage";
import ProfesoresAdminPage from "@/features/profesores/pages/ProfesoresAdminPage";
import ReportesPage from "@/features/dashboard/pages/ReportesPage";
import ConfiguracionPage from "@/features/dashboard/pages/ConfiguracionPage";
import { ProtectedRoute } from "./ProtectedRoute";

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/dashboard" element={<DashboardPage />} />

          <Route element={<ProtectedRoute rolesPermitidos={["admin", "secretario"]} />}>
            <Route path="/alumnos" element={<AlumnosListPage />} />
            <Route path="/alumnos/inscribir" element={<InscribirAlumnoPage />} />
            <Route path="/alumnos/:id" element={<AlumnoDetailPage />} />
            <Route path="/cuotas" element={<CuotasPage />} />
            <Route path="/chats" element={<ChatsAdminPage />} />
          </Route>

          <Route element={<ProtectedRoute rolesPermitidos={["admin"]} />}>
            <Route path="/usuarios" element={<UsuariosPage />} />
            <Route path="/profesores" element={<ProfesoresAdminPage />} />
            <Route path="/cursos-todos" element={<CursosAdminPage />} />
            <Route path="/reportes" element={<ReportesPage />} />
            <Route path="/configuracion" element={<ConfiguracionPage />} />
          </Route>

          <Route element={<ProtectedRoute rolesPermitidos={["profesor"]} />}>
            <Route path="/cursos" element={<MisCursosPage />} />
            <Route path="/asistencia" element={<AsistenciaProfesorPage />} />
            <Route path="/calificaciones" element={<CalificacionesProfesorPage />} />
            <Route path="/observaciones" element={<ObservacionesProfesorPage />} />
          </Route>

          <Route element={<ProtectedRoute rolesPermitidos={["padre"]} />}>
            <Route path="/mis-hijos" element={<ParentDashboardPage />} />
            <Route path="/mis-hijos/calificaciones" element={<ParentDashboardPage />} />
            <Route path="/mis-hijos/asistencia" element={<ParentDashboardPage />} />
            <Route path="/mis-hijos/cuotas" element={<ParentDashboardPage />} />
            <Route path="/mis-hijos/documentacion" element={<ParentDashboardPage />} />
            <Route path="/chat" element={<ChatPage />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
