// Planificación pura del asistente "Pasar de año": a partir de lo que hay (cursos del origen con sus alumnos activos, cursos
// que ya existen en el destino, quiénes ya están inscriptos allí) y de lo que decidió el administrador, dice qué se va a
// hacer. La usan la vista previa (que no escribe) y la confirmación (que vuelve a planificar dentro de la transacción).
// Sin Prisma ni Express: se prueba con una tabla de casos.

export type DestinoDeAlumnos =
  | { tipo: "curso"; cursoId: string } // un curso que ya existe en el destino
  | { tipo: "copia"; copiaDe: string } // la copia (de este curso de origen) que se crea o se reutiliza
  | { tipo: "egresan" }
  | { tipo: "no-continuan" };

export interface CursoOrigen {
  id: string;
  nombre: string;
  // Alumnos activos con inscripción en este curso del ciclo de origen.
  alumnos: { id: string; nombre: string; cursoActualId: string | null }[];
}

export interface DatosDelPlan {
  origen: CursoOrigen[];
  cursosDestino: { id: string; nombre: string }[];
  yaInscriptos: Map<string, string>; // alumnoId → nombre del curso en que ya está inscripto en el destino
  copiar: string[]; // ids de cursos de origen a copiar
  decisiones: { cursoOrigenId: string; destino?: DestinoDeAlumnos; excepciones?: { alumnoId: string; destino: DestinoDeAlumnos }[] }[];
}

export interface Plan {
  copias: { cursoOrigenId: string; reutilizaCursoId: string | null }[];
  movimientos: { alumnoId: string; destino: DestinoDeAlumnos }[];
  yaInscriptos: { alumnoId: string; cursoNombre: string }[]; // se saltean
  avisos: { alumnoId: string; tipo: "curso-actual-distinto" }[]; // no bloquean
  cursosSinDecision: string[];
  invalidos: string[]; // referencias que no existen ("copia:<id>", "curso:<id>", "origen:<id>")
}

// Para comparar nombres de curso sin mirar mayúsculas, tildes ni espacios de más.
const normalizar = (nombre: string) => nombre.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().replace(/\s+/g, " ").trim();

export function planificarPaseDeAnio(datos: DatosDelPlan): Plan {
  const idsOrigen = new Set(datos.origen.map((c) => c.id));
  const idsDestino = new Set(datos.cursosDestino.map((c) => c.id));
  const copiar = new Set(datos.copiar);
  const invalidos = new Set<string>();
  const cursosSinDecision: string[] = [];

  // Un curso que ya existe en el destino lo usa a lo sumo un curso del origen: si dos tienen el mismo nombre, el segundo se
  // crea aparte (si no, los alumnos de cursos distintos quedarían juntos sin que nadie lo decida).
  const reutilizados = new Set<string>();
  const copias = [...copiar].flatMap((cursoOrigenId) => {
    const curso = datos.origen.find((c) => c.id === cursoOrigenId);
    if (!curso) {
      invalidos.add(`origen:${cursoOrigenId}`);
      return [];
    }
    const existente = datos.cursosDestino.find((d) => !reutilizados.has(d.id) && normalizar(d.nombre) === normalizar(curso.nombre));
    if (existente) reutilizados.add(existente.id);
    return [{ cursoOrigenId, reutilizaCursoId: existente?.id ?? null }];
  });

  const destinoValido = (destino: DestinoDeAlumnos): boolean => {
    if (destino.tipo === "curso" && !idsDestino.has(destino.cursoId)) {
      invalidos.add(`curso:${destino.cursoId}`);
      return false;
    }
    if (destino.tipo === "copia" && !(copiar.has(destino.copiaDe) && idsOrigen.has(destino.copiaDe))) {
      invalidos.add(`copia:${destino.copiaDe}`);
      return false;
    }
    return true;
  };

  const movimientos: Plan["movimientos"] = [];
  const yaInscriptos: Plan["yaInscriptos"] = [];
  const avisos: Plan["avisos"] = [];
  for (const curso of datos.origen) {
    const decision = datos.decisiones.find((d) => d.cursoOrigenId === curso.id);
    let faltaDecision = false;
    for (const alumno of curso.alumnos) {
      if (alumno.cursoActualId !== null && alumno.cursoActualId !== curso.id) avisos.push({ alumnoId: alumno.id, tipo: "curso-actual-distinto" });
      const cursoNombre = datos.yaInscriptos.get(alumno.id);
      if (cursoNombre !== undefined) {
        yaInscriptos.push({ alumnoId: alumno.id, cursoNombre });
        continue;
      }
      const destino = decision?.excepciones?.find((e) => e.alumnoId === alumno.id)?.destino ?? decision?.destino;
      if (!destino) {
        faltaDecision = true;
        continue;
      }
      if (destinoValido(destino)) movimientos.push({ alumnoId: alumno.id, destino });
    }
    if (faltaDecision) cursosSinDecision.push(curso.id);
  }

  return { copias, movimientos, yaInscriptos, avisos, cursosSinDecision, invalidos: [...invalidos] };
}
