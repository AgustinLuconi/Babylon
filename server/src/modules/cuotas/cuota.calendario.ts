// Reglas de calendario de las cuotas — funciones puras, sin acceso a datos. Los
// días y meses se cuentan en hora de Argentina (ver core/fechas.ts).
import { fechaHoraEnArgentina } from "../../core/fechas";


// Descuento por hermanos, sobre el valor de la cuota.
export const PORCENTAJE_DESCUENTO_HERMANOS = 10;

// Los meses con clases salen del calendario del ciclo (ciclos/ciclo.calendario.ts) y el día de vencimiento es el de
// Configuración (1 a 28, por defecto 10).

// Vencimiento como fecha calendario (medianoche UTC, igual que el resto de las
// fechas calendario). Una cuota que se genera después del día de vencimiento de su propio
// mes (alta a mitad de mes, o valor de cuota cargado tarde) vence el último día
// de ese mes, para no nacer ya vencida.
export function vencimientoDelMes(mes: number, anio: number, hoy: Date, diaVencimiento: number): Date {
  const hoyAr = fechaHoraEnArgentina(hoy);
  const esMesActual = hoyAr.anio === anio && hoyAr.mes === mes;
  if (esMesActual && hoyAr.dia > diaVencimiento) {
    return new Date(Date.UTC(anio, mes, 0));
  }
  return new Date(Date.UTC(anio, mes - 1, diaVencimiento));
}
