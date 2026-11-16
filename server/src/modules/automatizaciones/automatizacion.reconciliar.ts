export type ReglaId = "deuda_cuotas" | "inasistencias_seguidas";
export type MotivoCierre = "resuelta" | "regla-apagada" | "cambio-de-numero" | "ya-no-corresponde";

// Lo que una regla dice que tiene que estar en alerta ahora. `cursoId` es null en las reglas que no son de un curso.
export interface AlertaEsperada {
  alumnoId: string;
  cursoId: string | null;
  nivel: number;
}
export interface AlertaAbierta {
  id: string;
  alumnoId: string;
  cursoId: string | null;
  nivel: number;
}

export const claveDeAlerta = (a: { alumnoId: string; cursoId: string | null }): string => `${a.alumnoId}|${a.cursoId ?? ""}`;

// Reglas de vida de las alertas (puras: no leen ni escriben nada):
// - lo esperado que no está abierto se abre (una fila nueva: cada episodio es una alerta distinta);
// - lo abierto y esperado se actualiza solo si cambió el nivel;
// - lo abierto que ya no se espera se cierra, con el motivo que corresponda: si se apagó la regla o se cambió el número, ese;
//   si no, "resuelta" cuando el alumno sigue en la población de la regla y "ya-no-corresponde" cuando salió de ella.
export function reconciliarAlertas(entrada: {
  abiertas: AlertaAbierta[];
  esperadas: AlertaEsperada[];
  poblacion: Set<string>;
  causa: "revision" | "regla-apagada" | "cambio-de-numero";
  nuevoId: () => string;
}): {
  abrir: (AlertaEsperada & { id: string })[];
  actualizar: { id: string; nivel: number }[];
  cerrar: { id: string; motivo: MotivoCierre }[];
} {
  const { abiertas, esperadas, poblacion, causa, nuevoId } = entrada;
  const abiertasPorClave = new Map(abiertas.map((a) => [claveDeAlerta(a), a]));
  const esperadasPorClave = new Map(esperadas.map((e) => [claveDeAlerta(e), e]));

  const abrir = esperadas.filter((e) => !abiertasPorClave.has(claveDeAlerta(e))).map((e) => ({ ...e, id: nuevoId() }));
  const actualizar = abiertas.flatMap((a) => {
    const e = esperadasPorClave.get(claveDeAlerta(a));
    return e && e.nivel !== a.nivel ? [{ id: a.id, nivel: e.nivel }] : [];
  });
  const cerrar = abiertas
    .filter((a) => !esperadasPorClave.has(claveDeAlerta(a)))
    .map((a) => ({
      id: a.id,
      motivo: (causa !== "revision" ? causa : poblacion.has(claveDeAlerta(a)) ? "resuelta" : "ya-no-corresponde") as MotivoCierre,
    }));
  return { abrir, actualizar, cerrar };
}
