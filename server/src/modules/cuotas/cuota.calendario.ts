// Reglas de calendario de las cuotas — funciones puras, sin acceso a datos. Los
// días y meses se cuentan en hora de Argentina (ver core/fechas.ts).
import { fechaHoraEnArgentina } from "../../core/fechas";


// Ciclo lectivo: de marzo a noviembre. Fuera de esos meses no se generan cuotas.
export const MES_INICIO_CICLO = 3;
export const MES_FIN_CICLO = 11;

// Las cuotas vencen el día 10 de su mes.
export const DIA_VENCIMIENTO = 10;

// Descuento por hermanos, sobre el valor de la cuota.
export const PORCENTAJE_DESCUENTO_HERMANOS = 10;

export function esMesLectivo(mes: number): boolean {
  return mes >= MES_INICIO_CICLO && mes <= MES_FIN_CICLO;
}

// Vencimiento como fecha calendario (medianoche UTC, igual que el resto de las
// fechas calendario). Una cuota que se genera después del día 10 de su propio
// mes (alta a mitad de mes, o valor de cuota cargado tarde) vence el último día
// de ese mes, para no nacer ya vencida.
export function vencimientoDelMes(mes: number, anio: number, hoy: Date): Date {
  const hoyAr = fechaHoraEnArgentina(hoy);
  const esMesActual = hoyAr.anio === anio && hoyAr.mes === mes;
  if (esMesActual && hoyAr.dia > DIA_VENCIMIENTO) {
    return new Date(Date.UTC(anio, mes, 0));
  }
  return new Date(Date.UTC(anio, mes - 1, DIA_VENCIMIENTO));
}
