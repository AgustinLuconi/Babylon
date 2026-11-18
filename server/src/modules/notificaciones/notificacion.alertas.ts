// Textos de los avisos de las alertas automáticas (puros). Los avisos de estado se arman en `notificacion.criterios.prisma.ts`.
const cantidad = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

export const textoDeAlertaDeDeuda = (alumno: string, cuotas: number): string => `${alumno} debe ${cantidad(cuotas, "cuota vencida", "cuotas vencidas")}`;

export const textoDeAlertaDeFaltas = (alumno: string, faltas: number, curso: string): string =>
  `${alumno} tiene ${cantidad(faltas, "inasistencia seguida", "inasistencias seguidas")} en ${curso}`;

export const textoDeAlertaDeRiesgo = (alumno: string): string => `${alumno} tiene deuda e inasistencias seguidas`;

// `fecha` ya viene como dd/mm.
export const textoDeEvaluacionSinNotas = (evaluacion: string, curso: string, fecha: string): string => `${evaluacion} (${curso}) del ${fecha} todavía no tiene notas`;
