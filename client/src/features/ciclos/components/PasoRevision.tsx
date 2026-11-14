import type { VistaPreviaPaseDeAnio } from "../types";

// Paso 4: el resumen de lo que va a pasar, con lo que se saltea y los avisos.
export function PasoRevision({ vista }: { vista: VistaPreviaPaseDeAnio }) {
  const t = vista.totales;
  const nombres = new Map(vista.origen.flatMap((c) => c.alumnos.map((a) => [a.id, a.nombre] as const)));
  return (
    <div className="space-y-3 text-sm">
      <p className="text-base font-semibold">
        {t.pasan} pasan, {t.egresan} egresan, {t.noContinuan} no continúan; {t.cursosCopiados} cursos copiados.
      </p>
      <p className="text-muted-foreground">
        De {vista.origenAnio} a {vista.destinoAnio}
        {vista.destinoNuevo ? " (el ciclo se crea al confirmar)" : ""}.
      </p>
      {vista.advertenciaAnioEnCurso && (
        <p className="rounded-md border p-3 text-[13px]" style={{ borderColor: "var(--warning)", background: "var(--warning-soft)" }}>
          El año {vista.origenAnio} todavía no terminó: el legajo y el panel de las familias van a mostrar el curso nuevo de cada alumno desde
          ahora. Las listas de los cursos de {vista.origenAnio} no cambian.
        </p>
      )}
      {vista.yaInscriptos.length > 0 && (
        <div>
          <p className="font-medium">Se saltean (ya inscriptos en el destino):</p>
          <ul className="list-disc pl-5 text-muted-foreground">
            {vista.yaInscriptos.map((y) => (
              <li key={y.alumnoId}>
                {nombres.get(y.alumnoId) ?? y.alumnoId}: ya inscripto en {y.cursoNombre}
              </li>
            ))}
          </ul>
        </div>
      )}
      {vista.avisos.length > 0 && (
        <div>
          <p className="font-medium">Para revisar (no frena el pase):</p>
          <ul className="list-disc pl-5 text-muted-foreground">
            {vista.avisos.map((a) => (
              <li key={a.alumnoId}>{nombres.get(a.alumnoId) ?? a.alumnoId}: su curso actual no coincide con su inscripción de {vista.origenAnio}</li>
            ))}
          </ul>
        </div>
      )}
      {vista.cursosSinDecision.length > 0 && (
        <p className="text-destructive">
          Falta decidir a dónde van los alumnos de: {vista.cursosSinDecision.map((id) => vista.origen.find((c) => c.id === id)?.nombre ?? id).join(", ")}.
        </p>
      )}
    </div>
  );
}
