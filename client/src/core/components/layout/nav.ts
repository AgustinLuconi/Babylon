import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  BookOpen,
  CalendarCheck,
  ClipboardCheck,
  FileText,
  FolderCheck,
  GraduationCap,
  Home,
  KeyRound,
  LayoutDashboard,
  MessageCircle,
  MessageSquare,
  Receipt,
  Settings,
  Users,
} from "lucide-react";
import type { Rol } from "@/features/auth/types";

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

export interface NavGroup {
  group: string;
  items: NavItem[];
}

const NAV_ADMIN: NavGroup[] = [
  { group: "General", items: [{ to: "/dashboard", label: "Resumen", icon: LayoutDashboard }] },
  {
    group: "Académico",
    items: [
      { to: "/alumnos", label: "Alumnos", icon: Users },
      { to: "/profesores", label: "Profesores", icon: GraduationCap },
      { to: "/cursos-todos", label: "Cursos", icon: BookOpen },
    ],
  },
  {
    group: "Finanzas",
    items: [
      { to: "/cuotas", label: "Cuotas", icon: Receipt },
      { to: "/reportes", label: "Reportes", icon: BarChart3 },
    ],
  },
  { group: "Comunicación", items: [{ to: "/chats", label: "Chats", icon: MessageCircle }] },
  {
    group: "Sistema",
    items: [
      { to: "/usuarios", label: "Usuarios", icon: KeyRound },
      { to: "/configuracion", label: "Configuración", icon: Settings },
    ],
  },
];

const NAV_SECRETARIO: NavGroup[] = [
  { group: "General", items: [{ to: "/dashboard", label: "Resumen", icon: LayoutDashboard }] },
  {
    group: "Gestión",
    items: [
      { to: "/alumnos", label: "Alumnos", icon: Users },
      { to: "/cuotas", label: "Cuotas", icon: Receipt },
      { to: "/chats", label: "Chats", icon: MessageCircle },
    ],
  },
];

const NAV_PROFESOR: NavGroup[] = [
  {
    group: "Docencia",
    items: [
      { to: "/cursos", label: "Mis cursos", icon: BookOpen },
      { to: "/asistencia", label: "Asistencia", icon: ClipboardCheck },
      { to: "/calificaciones", label: "Calificaciones", icon: FileText },
      { to: "/observaciones", label: "Observaciones", icon: MessageSquare },
    ],
  },
];

const NAV_PADRE: NavGroup[] = [
  {
    group: "Mi familia",
    items: [
      { to: "/mis-hijos", label: "Resumen", icon: Home },
      { to: "/mis-hijos/calificaciones", label: "Calificaciones", icon: FileText },
      { to: "/mis-hijos/asistencia", label: "Asistencia", icon: CalendarCheck },
      { to: "/mis-hijos/cuotas", label: "Cuotas", icon: Receipt },
      { to: "/mis-hijos/documentacion", label: "Documentación", icon: FolderCheck },
      { to: "/chat", label: "Mensajes", icon: MessageCircle },
    ],
  },
];

export function navPorRol(rol: Rol): NavGroup[] {
  switch (rol) {
    case "admin":
      return NAV_ADMIN;
    case "secretario":
      return NAV_SECRETARIO;
    case "profesor":
      return NAV_PROFESOR;
    case "padre":
      return NAV_PADRE;
  }
}

export const AREA_POR_ROL: Record<Rol, string> = {
  admin: "Administración",
  secretario: "Secretaría",
  profesor: "Docente",
  padre: "Familia",
};
