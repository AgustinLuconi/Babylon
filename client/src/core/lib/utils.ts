import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const DIACRITICOS = /[\u0300-\u036f]/g;

export function normalizarTexto(texto: string): string {
  return texto.normalize("NFD").replace(DIACRITICOS, "").toLowerCase();
}

export function formatMonto(monto: number): string {
  return `$${monto.toLocaleString("es-AR")}`;
}

// Reordena un ISO "AAAA-MM-DD..." a "DD/MM/AAAA" con manipulación de string
// pura (sin pasar por Date), para no correrse un día por el huso horario
// local en campos que son fechas calendario (medianoche UTC), no instantes reales.
export function formatFecha(fechaIso: string): string {
  const [anio, mes, dia] = fechaIso.slice(0, 10).split("-");
  return `${dia}/${mes}/${anio}`;
}

// "08/10/2026 14:35" en la hora local del navegador (para instantes reales, como el inicio de una sesión).
export function formatFechaHora(iso: string): string {
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
    .format(new Date(iso))
    .replace(",", "");
}

// "15/10/2026" en la hora local del navegador (para instantes reales, como el envío de una invitación).
export function formatFechaCorta(iso: string): string {
  return new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(iso));
}

// "Viernes · 9 de mayo de 2026" — formato del eyebrow de fecha de los dashboards.
export function formatFechaLarga(fecha: Date = new Date()): string {
  const diaSemana = new Intl.DateTimeFormat("es-AR", { weekday: "long" }).format(fecha);
  const resto = new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "long", year: "numeric" }).format(fecha);
  return `${diaSemana} · ${resto}`;
}

// Fecha calendario LOCAL de cualquier Date, no en UTC — `date.toISOString()`
// se corre un día para usuarios en husos horarios negativos (ej. Argentina,
// UTC-3) durante las últimas horas del día.
export function fechaLocalISO(fecha: Date): string {
  const mes = String(fecha.getMonth() + 1).padStart(2, "0");
  const dia = String(fecha.getDate()).padStart(2, "0");
  return `${fecha.getFullYear()}-${mes}-${dia}`;
}

export function hoyLocalISO(): string {
  return fechaLocalISO(new Date());
}

export function calcularEdad(fechaISO: string | undefined): number | null {
  if (!fechaISO) return null;
  const nacimiento = new Date(fechaISO);
  if (Number.isNaN(nacimiento.getTime())) return null;
  const hoy = new Date();
  let edad = hoy.getFullYear() - nacimiento.getFullYear();
  const m = hoy.getMonth() - nacimiento.getMonth();
  if (m < 0 || (m === 0 && hoy.getDate() < nacimiento.getDate())) edad--;
  return edad >= 0 ? edad : null;
}

// Variación en puntos porcentuales, con el signo "−" tipográfico del prototipo.
export function formatearVariacionPp(pp: number): { delta: string; tono: "positive" | "negative" | "neutral" } {
  if (pp === 0) return { delta: "0 pp", tono: "neutral" };
  return { delta: `${pp > 0 ? "+" : "−"}${Math.abs(pp)} pp`, tono: pp > 0 ? "positive" : "negative" };
}

// Un celular guardado normalizado (+549 y 10 dígitos) se muestra legible; uno viejo con otro formato, tal cual.
export function formatCelular(telefono: string | undefined): string {
  if (!telefono) return "—";
  const m = /^\+549(\d{10})$/.exec(telefono);
  return m ? `+54 9 ${m[1].slice(0, -4)}-${m[1].slice(-4)}` : telefono;
}

// "45123456" -> "45.123.456". Solo para mostrar: el dato guardado y la
// búsqueda siguen usando los dígitos crudos. Si no son 7-8 dígitos (dato
// histórico con otro formato), se devuelve tal cual. Un alumno o responsable
// puede no tener el DNI cargado todavía.
export function formatDni(dni: string | undefined): string {
  if (!dni) return "sin cargar";
  return /^\d{7,8}$/.test(dni) ? dni.replace(/\B(?=(\d{3})+(?!\d))/g, ".") : dni;
}

const NOMBRES_MES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
// 1..12 -> "Agosto"
export function nombreMes(mes: number): string {
  return NOMBRES_MES[mes - 1] ?? String(mes);
}
