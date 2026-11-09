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
import type { EtiquetasDelPanel } from "./etiquetasDelPanel";

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  // Número a mostrar al lado (mensajes sin leer).
  contador?: "chats";
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
  { group: "Comunicación", items: [{ to: "/chats", label: "Chats", icon: MessageCircle, contador: "chats" }] },
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
      { to: "/chats", label: "Chats", icon: MessageCircle, contador: "chats" },
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

// El menú del responsable: los mismos destinos para todos, con los textos de su modo (familia, adulto solo o adulto con hijos).
function navDelPadre({ grupo, menu }: EtiquetasDelPanel): NavGroup[] {
  return [
    {
      group: grupo,
      items: [
        { to: "/mis-hijos", label: menu.resumen, icon: Home },
        { to: "/mis-hijos/calificaciones", label: menu.notas, icon: FileText },
        { to: "/mis-hijos/asistencia", label: menu.asistencia, icon: CalendarCheck },
        { to: "/mis-hijos/cuotas", label: menu.cuotas, icon: Receipt },
        { to: "/mis-hijos/documentacion", label: menu.documentacion, icon: FolderCheck },
        { to: "/chat", label: menu.chat, icon: MessageCircle, contador: "chats" },
      ],
    },
  ];
}

export function navPorRol(rol: Rol, etiquetasDelPadre: EtiquetasDelPanel): NavGroup[] {
  switch (rol) {
    case "admin":
      return NAV_ADMIN;
    case "secretario":
      return NAV_SECRETARIO;
    case "profesor":
      return NAV_PROFESOR;
    case "padre":
      return navDelPadre(etiquetasDelPadre);
  }
}

export const AREA_POR_ROL: Record<Rol, string> = {
  admin: "Administración",
  secretario: "Secretaría",
  profesor: "Docente",
  padre: "Familia",
};
