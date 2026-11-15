import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/core/components/ui/button";
import { Panel } from "@/core/components/ui/panel";
import { useFiltrosDeUrl } from "@/core/hooks/useFiltrosDeUrl";
import { ApiError } from "@/core/lib/apiClient";
import { descartarCambiosSinGuardar, useSinGuardar } from "@/core/sinGuardar/sinGuardar";
import { PasoAlumnos, type DecisionDeCurso } from "../components/PasoAlumnos";
import { PasoCierre, type Cierre } from "../components/PasoCierre";
import { PasoCiclos } from "../components/PasoCiclos";
import { PasoCursos } from "../components/PasoCursos";
import { PasoRevision } from "../components/PasoRevision";
import { useCiclos } from "../hooks/useCiclos";
import { useConfirmarPaseDeAnio, useVistaPreviaPaseDeAnio } from "../hooks/usePaseDeAnio";
import { cierreInicial, destinoDeValor, sinCopiasQueNoEstan } from "../paseDeAnio";
import type { PaseDeAnioInput, ResumenPaseDeAnio } from "../types";

const PASOS = ["Ciclos", "Cursos", "Alumnos", "Revisión", "Cierre"];

// Asistente "Pasar de año" (solo administrador): copia los cursos al ciclo siguiente y pasa a los alumnos a su curso nuevo.
// La vista previa se pide con cada cambio; nada se escribe hasta confirmar en el último paso.
export default function PasarDeAnioPage() {
  const { data: ciclos } = useCiclos();
  const confirmar = useConfirmarPaseDeAnio();
  const [paso, setPaso] = useState(1);
  const [origenId, setOrigenId] = useState("");
  // El aviso de fin de año abre el asistente con el ciclo ya elegido (?origen=): se usa una sola vez y no cuenta como algo sin guardar.
  const { leer } = useFiltrosDeUrl();
  const origenPedido = leer("origen");
  const [origenPreseleccionado, setOrigenPreseleccionado] = useState<string | null>(null);
  const [destinoModo, setDestinoModo] = useState<"existente" | "nuevo">("existente");
  const [destinoCicloId, setDestinoCicloId] = useState("");
  const [anioNuevo, setAnioNuevo] = useState("");
  const [copiar, setCopiar] = useState<string[] | null>(null);
  const [decisiones, setDecisiones] = useState<Record<string, DecisionDeCurso>>({});
  // null = todavía sin tocar: viene marcado solo si el año del origen ya terminó (ver `cierreInicial`).
  const [cierreElegido, setCierreElegido] = useState<Cierre | null>(null);
  const [resumen, setResumen] = useState<ResumenPaseDeAnio | null>(null);

  const destinoValido = destinoModo === "existente" ? destinoCicloId !== "" : /^\d{4}$/.test(anioNuevo);
  const input = useMemo<PaseDeAnioInput | null>(() => {
    if (!origenId || !destinoValido) return null;
    return {
      origenId,
      destino: destinoModo === "existente" ? { cicloId: destinoCicloId } : { anio: Number(anioNuevo) },
      copiarCursoIds: copiar ?? [],
      cursos: Object.entries(decisiones).map(([cursoOrigenId, d]) => ({
        cursoOrigenId,
        destino: destinoDeValor(d.destino),
        excepciones: Object.entries(d.excepciones).flatMap(([alumnoId, v]) => {
          const destino = destinoDeValor(v);
          return destino ? [{ alumnoId, destino }] : [];
        }),
      })),
    };
  }, [origenId, destinoValido, destinoModo, destinoCicloId, anioNuevo, copiar, decisiones]);

  const { data: vista, error, isFetching, isPlaceholderData } = useVistaPreviaPaseDeAnio(input);
  const cierre = cierreElegido ?? cierreInicial(vista?.advertenciaAnioEnCurso ?? true);
  const origenActivo = ciclos?.find((c) => c.id === origenId)?.activo ?? false;
  const errorDeVista = error instanceof ApiError ? error.message : error ? "No se pudo preparar la vista previa" : null;

  // Al elegir los ciclos, se marcan para copiar los cursos que tienen alumnos activos (después se ajusta a mano).
  // Mientras llega la vista previa nueva, `vista` todavía es la del ciclo anterior (`isPlaceholderData`): no se usa.
  useEffect(() => {
    if (vista && !isPlaceholderData && copiar === null) setCopiar(vista.origen.filter((c) => c.alumnos.length > 0).map((c) => c.id));
  }, [vista, isPlaceholderData, copiar]);

  useEffect(() => {
    if (origenPreseleccionado !== null || !origenPedido || !ciclos) return;
    setOrigenPreseleccionado(origenPedido);
    if (ciclos.some((c) => c.id === origenPedido && !c.bloqueado)) setOrigenId((actual) => actual || origenPedido);
  }, [origenPedido, ciclos, origenPreseleccionado]);

  useSinGuardar(resumen === null && (paso > 1 || (origenId !== "" && origenId !== origenPreseleccionado)));

  const cambiarCiclos = (cambio: () => void) => {
    cambio();
    setCopiar(null);
    setDecisiones({});
    setCierreElegido(null);
  };

  // Al desmarcar un curso, lo que apuntaba a su copia se limpia (si no, el select quedaría con un valor que ya no existe).
  const cambiarCopiar = (ids: string[]) => {
    setCopiar(ids);
    setDecisiones((previas) => sinCopiasQueNoEstan(previas, ids));
  };
  const hayInvalidos = (vista?.invalidos.length ?? 0) > 0;

  const puedeAvanzar =
    (paso === 1 && !!vista && !errorDeVista) ||
    paso === 2 ||
    (paso === 3 && !!vista && vista.cursosSinDecision.length === 0 && !hayInvalidos) ||
    (paso === 4 && !!vista && vista.cursosSinDecision.length === 0 && !hayInvalidos);

  // Un solo envío a la vez: con un doble clic, TanStack solo avisa del último, y un segundo pedido contra el ciclo ya
  // bloqueado mostraría un error aunque el pase se hubiera hecho.
  const enviando = useRef(false);
  const onConfirmar = () => {
    if (!input || enviando.current) return;
    enviando.current = true;
    confirmar
      .mutateAsync({ ...input, cierre })
      .then((r) => {
        descartarCambiosSinGuardar();
        setResumen(r);
      })
      .catch(() => {
        // El error se muestra con `confirmar.isError`.
      })
      .finally(() => {
        enviando.current = false;
      });
  };

  if (resumen) {
    return (
      <Panel title="Pase de año hecho">
        <div className="space-y-3 p-5 text-sm">
          <p>
            Pasaron {resumen.pasan} alumnos, egresaron {resumen.egresan} y {resumen.noContinuan} no continúan. Se crearon {resumen.cursosCreados} cursos
            nuevos y se reutilizaron {resumen.cursosReutilizados}.
            {resumen.yaInscriptos > 0 ? ` ${resumen.yaInscriptos} alumnos ya estaban inscriptos y se dejaron como estaban.` : ""}
          </p>
          <Link to="/configuracion" className="text-sm underline">
            Volver a Configuración
          </Link>
        </div>
      </Panel>
    );
  }

  return (
    <div className="space-y-4">
      <ol className="flex flex-wrap gap-x-4 gap-y-1 text-[12.5px]">
        {PASOS.map((nombre, i) => (
          <li key={nombre} className={paso === i + 1 ? "font-semibold" : "text-muted-foreground"}>
            {i + 1}. {nombre}
          </li>
        ))}
      </ol>

      <Panel title={`Paso ${paso}: ${PASOS[paso - 1]}`}>
        <div className="space-y-4 p-5">
          {paso === 1 && (
            <PasoCiclos
              ciclos={ciclos ?? []}
              origenId={origenId}
              onOrigen={(id) => cambiarCiclos(() => setOrigenId(id))}
              destinoModo={destinoModo}
              onDestinoModo={(m) => cambiarCiclos(() => setDestinoModo(m))}
              destinoCicloId={destinoCicloId}
              onDestinoCicloId={(id) => cambiarCiclos(() => setDestinoCicloId(id))}
              anioNuevo={anioNuevo}
              onAnioNuevo={(a) => cambiarCiclos(() => setAnioNuevo(a))}
            />
          )}
          {paso === 2 && vista && <PasoCursos vista={vista} copiar={copiar ?? []} onCopiar={cambiarCopiar} />}
          {paso === 3 && vista && (
            <PasoAlumnos
              vista={vista}
              copiar={copiar ?? []}
              decisiones={decisiones}
              onDecision={(cursoId, d) => setDecisiones((previas) => ({ ...previas, [cursoId]: d }))}
            />
          )}
          {paso === 4 && vista && <PasoRevision vista={vista} />}
          {paso === 5 && vista && <PasoCierre origenAnio={vista.origenAnio} destinoAnio={vista.destinoAnio} origenActivo={origenActivo} cierre={cierre} onCierre={setCierreElegido} />}

          {hayInvalidos && (
            <p className="text-sm text-destructive">Hay decisiones que ya no son válidas (por ejemplo, un curso que dejaste de copiar). Volvé al paso 3 y revisalas.</p>
          )}
          {errorDeVista && <p className="text-sm text-destructive">{errorDeVista}</p>}
          {confirmar.isError && (
            <p className="text-sm text-destructive">
              {confirmar.error instanceof ApiError ? confirmar.error.message : "No se pudo hacer el pase de año"}
            </p>
          )}

          <div className="flex justify-between border-t pt-4" style={{ borderColor: "var(--border-hex)" }}>
            <Button variant="outline" disabled={paso === 1 || confirmar.isPending} onClick={() => setPaso(paso - 1)}>
              Atrás
            </Button>
            {paso < 5 ? (
              <Button disabled={!puedeAvanzar || isFetching} onClick={() => setPaso(paso + 1)}>
                Siguiente
              </Button>
            ) : (
              <Button disabled={!vista || vista.cursosSinDecision.length > 0 || hayInvalidos || isFetching || confirmar.isPending} onClick={onConfirmar}>
                Confirmar el pase de año
              </Button>
            )}
          </div>
        </div>
      </Panel>
    </div>
  );
}
