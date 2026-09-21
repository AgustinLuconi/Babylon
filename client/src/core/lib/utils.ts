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

export function calcularEdad(fechaISO: string): number | null {
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

// "45123456" -> "45.123.456". Solo para mostrar: el dato guardado y la
// búsqueda siguen usando los dígitos crudos. Si no son 7-8 dígitos (dato
// histórico con otro formato), se devuelve tal cual.
export function formatDni(dni: string): string {
  return /^\d{7,8}$/.test(dni) ? dni.replace(/\B(?=(\d{3})+(?!\d))/g, ".") : dni;
}
