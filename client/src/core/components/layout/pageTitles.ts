const ANIO_ACTUAL = new Date().getFullYear();

// Coincide en forma con SCREEN_TITLES del prototipo — mapea por prefijo de ruta
// en vez de por id de pantalla, ya que acá se navega con React Router.
const TITULOS: { prefijo: string; titulo: string; subtitulo: string }[] = [
  { prefijo: "/dashboard", titulo: "Resumen general", subtitulo: "Estado actual del instituto" },
  { prefijo: "/alumnos", titulo: "Alumnos", subtitulo: "Legajos, cursos y estado de cuota" },
  { prefijo: "/profesores", titulo: "Profesores", subtitulo: "Plantel docente y asignaciones" },
  { prefijo: "/cursos-todos", titulo: "Cursos", subtitulo: `Comisiones del ciclo ${ANIO_ACTUAL}` },
  { prefijo: "/cursos", titulo: "Mis cursos", subtitulo: `Comisiones a cargo · ${ANIO_ACTUAL}` },
  { prefijo: "/cuotas", titulo: "Cuotas", subtitulo: "Cobranza y conciliación de cuotas" },
  { prefijo: "/reportes", titulo: "Reportes", subtitulo: "Informes académicos y financieros" },
  { prefijo: "/usuarios", titulo: "Usuarios del sistema", subtitulo: "Acceso, roles y permisos" },
  { prefijo: "/configuracion", titulo: "Configuración", subtitulo: "Parámetros del sistema" },
  { prefijo: "/chats", titulo: "Chats", subtitulo: "Consultas de las familias con administración" },
  { prefijo: "/asistencia", titulo: "Asistencia", subtitulo: "Registro de presentes, tardanzas y ausencias" },
  { prefijo: "/calificaciones", titulo: "Calificaciones", subtitulo: "Carga y publicación de evaluaciones" },
  { prefijo: "/observaciones", titulo: "Observaciones", subtitulo: "Comunicaciones al tutor del alumno" },
  { prefijo: "/mis-hijos/calificaciones", titulo: "Calificaciones", subtitulo: "" },
  { prefijo: "/mis-hijos/asistencia", titulo: "Asistencia", subtitulo: "" },
  { prefijo: "/mis-hijos/cuotas", titulo: "Cuotas", subtitulo: "" },
  { prefijo: "/mis-hijos/documentacion", titulo: "Documentación", subtitulo: "Legajo digital de tu hijo/a" },
  { prefijo: "/mis-hijos", titulo: "Resumen", subtitulo: "Estado académico y de cuotas" },
  { prefijo: "/chat", titulo: "Mensajes", subtitulo: "Consultas con administración" },
];

export function obtenerTituloPagina(pathname: string): { titulo: string; subtitulo: string } | null {
  const match = TITULOS.filter((t) => pathname.startsWith(t.prefijo)).sort((a, b) => b.prefijo.length - a.prefijo.length)[0];
  return match ? { titulo: match.titulo, subtitulo: match.subtitulo } : null;
}
