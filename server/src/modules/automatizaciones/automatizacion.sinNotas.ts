const DIA_MS = 24 * 60 * 60 * 1000;

// Una evaluación está "sin notas" cuando pasaron `dias` días o más desde su fecha y no tiene ninguna nota cargada.
// `fecha` y `hoy` son fechas calendario (medianoche UTC; `hoy` = `inicioDeHoyUtc()`). Función pura.
export function evaluacionSinNotas(evaluacion: { fecha: Date; notas: number }, hoy: Date, dias: number): boolean {
  return evaluacion.notas === 0 && evaluacion.fecha.getTime() <= hoy.getTime() - dias * DIA_MS;
}
