import { useEffect, useImperativeHandle, useMemo, useState, type Ref } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Check, Search } from "lucide-react";
import { Avatar } from "@/core/components/ui/avatar";
import { Button } from "@/core/components/ui/button";
import { Input } from "@/core/components/ui/input";
import { Label } from "@/core/components/ui/label";
import { Select } from "@/core/components/ui/select";
import { celularSchema, dniSchema, emailSchema, opcional, textoRequerido } from "@/core/lib/validacion";
import { formatDni, normalizarTexto } from "@/core/lib/utils";
import type { Alumno } from "@/features/alumnos/types";
import { fichasCoincidentes, fichasParecidas, type MotivoDeCoincidencia } from "../fichasParecidas";
import { VINCULO_LABELS, VINCULOS_DE_OTRA_PERSONA, type Padre, type ResponsableElegido, type VinculoDeOtraPersona } from "../types";

type Modo = "existente" | "nuevo" | "propio";

const nuevoSchema = z.object({
  nombre: textoRequerido("El nombre", 60),
  apellido: textoRequerido("El apellido", 60),
  telefono: celularSchema,
  dni: opcional(dniSchema),
  email: opcional(emailSchema),
  vinculo: z.enum(VINCULOS_DE_OTRA_PERSONA as [VinculoDeOtraPersona, ...VinculoDeOtraPersona[]], { error: "Elegí el vínculo con el alumno" }),
});
type NuevoForm = z.input<typeof nuevoSchema>;

// Lo que devuelve `validar()`: el responsable elegido y, si hace falta, el DNI que hay que completarle a una ficha que
// ya existía sin él (se le guarda antes de inscribir).
export interface ResultadoDelSelector {
  responsable: ResponsableElegido;
  completarDni?: { padreId: string; dni: string };
}

export interface SelectorDeResponsableHandle {
  validar(): Promise<ResultadoDelSelector | null>;
}

interface Props {
  ref?: Ref<SelectorDeResponsableHandle>;
  padres: Padre[] | undefined;
  alumnos: Alumno[] | undefined;
  // Un adulto puede ser responsable de sí mismo.
  esAdulto: boolean;
  // Los datos de la persona que se inscribe (se usan cuando es responsable de sí misma).
  alumno: { nombre: string; apellido: string; dni?: string };
  // Errores que devolvió el servidor, por el nombre del campo ("telefono", "dni", "email"…).
  erroresDelServidor?: Record<string, string>;
  onModificado?: (modificado: boolean) => void;
}

const MENSAJE_CELULAR = "El celular no es válido: escribilo con el código de área, por ejemplo 351 555-1234";

function Mensaje({ mensaje }: { mensaje?: string }) {
  return mensaje ? <p className="text-sm text-destructive">{mensaje}</p> : null;
}

// Quién es el responsable del alumno: una ficha que ya existe, una nueva (nombre, apellido y celular alcanzan) o el propio
// alumno (un adulto). Antes de crear una ficha nueva avisa si ya hay una parecida y obliga a elegir si es la misma persona.
export function SelectorDeResponsable({ ref, padres, alumnos, esAdulto, alumno, erroresDelServidor, onModificado }: Props) {
  const [modo, setModo] = useState<Modo>("existente");
  const [busqueda, setBusqueda] = useState("");
  const [seleccionado, setSeleccionado] = useState<Padre | null>(null);
  const [vinculoExistente, setVinculoExistente] = useState<VinculoDeOtraPersona | "">("");
  const [dniParaCompletar, setDniParaCompletar] = useState<{ padreId: string; dni: string } | null>(null);
  const [propio, setPropio] = useState({ telefono: "", email: "" });
  const [errores, setErrores] = useState<Record<string, string>>({});
  // La elección frente a fichas parecidas vale para esa lista de fichas: si cambian los nombres, hay que volver a elegir.
  const [decision, setDecision] = useState<{ clave: string } | null>(null);

  const nuevo = useForm<NuevoForm>({ resolver: zodResolver(nuevoSchema), defaultValues: { vinculo: undefined } });
  const valoresNuevo = nuevo.watch();

  // Si deja de poder ser responsable de sí mismo (cambió el curso o la fecha), vuelve a "ya existe".
  useEffect(() => {
    if (!esAdulto && modo === "propio") setModo("existente");
  }, [esAdulto, modo]);

  useEffect(() => {
    onModificado?.(modo !== "existente" || seleccionado !== null || nuevo.formState.isDirty || propio.telefono !== "");
  }, [modo, seleccionado, nuevo.formState.isDirty, propio.telefono, onModificado]);

  // Errores del servidor: cada uno al lado de su campo.
  useEffect(() => {
    if (!erroresDelServidor) return;
    for (const [campo, mensaje] of Object.entries(erroresDelServidor)) {
      const hoja = campo.split(".").pop() as string;
      if (modo === "nuevo" && hoja in nuevoSchema.shape) nuevo.setError(hoja as keyof NuevoForm, { message: mensaje });
      else setErrores((e) => ({ ...e, [hoja]: mensaje }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [erroresDelServidor]);

  const padresFiltrados = useMemo(() => {
    const termino = normalizarTexto(busqueda.trim());
    if (!termino) return padres ?? [];
    return (padres ?? []).filter((p) => normalizarTexto(`${p.nombre} ${p.apellido} ${p.dni ?? ""} ${p.email ?? ""}`).includes(termino));
  }, [padres, busqueda]);

  const hijosDe = (padreId: string) => (alumnos ?? []).filter((a) => a.padreId === padreId && a.estado === "activo");

  // Fichas que podrían ser la misma persona que la que se va a crear (con el mismo DNI del alumno propio, el servidor
  // reutiliza la ficha solo: no hace falta preguntar).
  // Con el mismo DNI, celular o email casi seguro es la misma persona: no se ofrece "es otra persona" (hay que usar esa
  // ficha o corregir el dato). Se calcula mientras se escribe.
  const coincidentes = useMemo(
    () => (modo === "nuevo" ? fichasCoincidentes({ dni: String(valoresNuevo.dni ?? ""), telefono: valoresNuevo.telefono, email: String(valoresNuevo.email ?? "") }, padres ?? []) : []),
    [modo, valoresNuevo.dni, valoresNuevo.telefono, valoresNuevo.email, padres],
  );
  const parecidas = useMemo(() => {
    if (modo === "nuevo") {
      const yaMostradas = new Set(coincidentes.map((c) => c.ficha.id));
      return fichasParecidas({ nombre: valoresNuevo.nombre ?? "", apellido: valoresNuevo.apellido ?? "" }, padres ?? []).filter((f) => !yaMostradas.has(f.id));
    }
    if (modo === "propio") {
      return fichasParecidas(alumno, padres ?? []).filter((f) => !alumno.dni || normalizarDniSimple(f.dni) !== normalizarDniSimple(alumno.dni));
    }
    return [];
  }, [modo, valoresNuevo.nombre, valoresNuevo.apellido, alumno, padres, coincidentes]);
  // Un adulto "propio" cuyo DNI ya es de una ficha: el servidor reutiliza esa ficha y manda ella (el alumno toma su nombre).
  // Se muestra cuál es y, si el nombre no se parece (un DNI mal tipeado daría con otra persona), hay que confirmarlo.
  const fichaPorDni = useMemo(() => {
    if (modo !== "propio" || !alumno.dni) return undefined;
    return (padres ?? []).find((f) => normalizarDniSimple(f.dni) === normalizarDniSimple(alumno.dni));
  }, [modo, alumno.dni, padres]);
  const nombreCoincide = fichaPorDni ? fichasParecidas(alumno, [fichaPorDni]).length > 0 : true;
  const [fichaConfirmada, setFichaConfirmada] = useState<string | null>(null);
  const clave = `${modo}:${parecidas.map((f) => f.id).join(",")}`;
  const decidido = decision?.clave === clave;

  const elegirModo = (nuevoModo: Modo) => {
    setModo(nuevoModo);
    setErrores({});
  };

  // "Es la misma persona": se usa su ficha. Para un menor, pasa a "ya existe"; para un adulto propio, se le completa el
  // DNI si no lo tenía (así el servidor la reconoce por DNI).
  const usarFicha = (ficha: Padre) => {
    if (modo === "nuevo") {
      const dniEscrito = valoresNuevo.dni ? dniSchema.safeParse(valoresNuevo.dni) : null;
      setDniParaCompletar(!ficha.dni && dniEscrito?.success ? { padreId: ficha.id, dni: dniEscrito.data } : null);
      setVinculoExistente((valoresNuevo.vinculo as VinculoDeOtraPersona | undefined) ?? "");
      setSeleccionado(ficha);
      setModo("existente");
    } else if (alumno.dni && !ficha.dni) {
      setDniParaCompletar({ padreId: ficha.id, dni: alumno.dni });
      setDecision({ clave });
    }
  };
  const puedeUsarFichaPropia = (ficha: Padre) => Boolean(alumno.dni) && !ficha.dni;

  useImperativeHandle(ref, () => ({
    async validar() {
      setErrores({});
      if (modo === "existente") {
        if (!seleccionado) return fallo("responsable", "Elegí un responsable que ya exista o cargá uno nuevo");
        if (!vinculoExistente) return fallo("vinculo", "Elegí el vínculo con el alumno");
        return { responsable: { tipo: "existente", padreId: seleccionado.id, vinculo: vinculoExistente }, completarDni: dniParaCompletar ?? undefined };
      }
      if (modo === "nuevo") {
        if (!(await nuevo.trigger())) return null;
        const v = nuevoSchema.parse(nuevo.getValues());
        if (coincidentes.length > 0) return fallo("coincidentes", "Ya hay un responsable con esos datos: usá esa ficha o corregí el dato repetido");
        if (parecidas.length > 0 && !decidido) return fallo("parecidas", "Elegí si es la misma persona que una ficha que ya existe");
        return {
          responsable: {
            tipo: "nuevo",
            vinculo: v.vinculo,
            datos: { nombre: v.nombre, apellido: v.apellido, telefono: v.telefono, dni: v.dni, email: v.email },
          },
        };
      }
      // propio
      const telefono = celularSchema.safeParse(propio.telefono);
      if (!telefono.success) return fallo("telefono", propio.telefono.trim() ? MENSAJE_CELULAR : "El celular es requerido");
      const email = propio.email.trim() ? emailSchema.safeParse(propio.email) : null;
      if (email && !email.success) return fallo("email", "Email inválido");
      if (fichaPorDni && !nombreCoincide && fichaConfirmada !== fichaPorDni.id) {
        return fallo("fichaPorDni", "Confirmá que es la misma persona o corregí el DNI del alumno");
      }
      if (parecidas.length > 0 && !decidido) return fallo("parecidas", "Elegí si es la misma persona que una ficha que ya existe");
      return {
        responsable: {
          tipo: "propio",
          telefono: telefono.data,
          email: email?.success ? email.data : undefined,
        },
        completarDni: dniParaCompletar ?? undefined,
      };
    },
  }));

  function fallo(campo: string, mensaje: string): null {
    setErrores({ [campo]: mensaje });
    return null;
  }

  const opciones: [Modo, string][] = [
    ["existente", "Ya existe en el sistema"],
    ["nuevo", "Cargar uno nuevo"],
    ...(esAdulto ? ([["propio", "Es responsable de sí mismo"]] as [Modo, string][]) : []),
  ];
  const hermanos = modo === "existente" && seleccionado ? hijosDe(seleccionado.id) : [];
  const ficha = (f: Padre) => `${f.nombre} ${f.apellido} · DNI ${formatDni(f.dni)}${f.telefono ? ` · ${f.telefono}` : ""}`;

  return (
    <div className="space-y-4">
      <div>
        <Label>¿Quién es el responsable del alumno?</Label>
        <div className="mt-1.5 flex gap-2">
          {opciones.map(([valor, etiqueta]) => {
            const activo = modo === valor;
            return (
              <button
                key={valor}
                type="button"
                onClick={() => elegirModo(valor)}
                className="flex-1 rounded py-2.5 text-[13px] font-medium transition-all"
                style={{ border: `1px solid ${activo ? "var(--brand)" : "var(--border-hex)"}`, background: activo ? "var(--brand-soft)" : "var(--bg)", color: activo ? "var(--brand)" : "var(--text)" }}
              >
                {etiqueta}
              </button>
            );
          })}
        </div>
      </div>

      {modo === "existente" && (
        <div className="space-y-3">
          <div>
            <Label>Buscar responsable</Label>
            <div className="relative mt-1.5">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-faint)" }} />
              <Input placeholder="Nombre, email o DNI…" data-sin-enter className="pl-7" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
            </div>
          </div>
          <div className="max-h-[200px] overflow-y-auto rounded border" style={{ borderColor: "var(--border-hex)" }}>
            {padresFiltrados.length === 0 && (
              <p className="px-4 py-4 text-center text-[12.5px]" style={{ color: "var(--text-faint)" }}>
                Sin resultados
              </p>
            )}
            {padresFiltrados.map((padre, i) => {
              const activo = seleccionado?.id === padre.id;
              const hijos = hijosDe(padre.id).length;
              return (
                <button
                  type="button"
                  key={padre.id}
                  onClick={() => {
                    setSeleccionado(padre);
                    setDniParaCompletar(null);
                    setErrores({});
                  }}
                  className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-all"
                  style={{ background: activo ? "var(--brand-soft)" : i % 2 === 0 ? "var(--bg)" : "var(--bg-subtle)" }}
                >
                  <Avatar name={`${padre.nombre} ${padre.apellido}`} size="xs" tone={activo ? "brand" : "neutral"} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium" style={{ color: activo ? "var(--brand)" : "var(--text)" }}>
                      {padre.nombre} {padre.apellido}
                    </p>
                    <p className="text-[11px]" style={{ color: "var(--text-faint)" }}>
                      {hijos} alumno{hijos !== 1 ? "s" : ""} inscripto{hijos !== 1 ? "s" : ""} · DNI {formatDni(padre.dni)}
                    </p>
                  </div>
                  {activo && <Check size={13} className="shrink-0" style={{ color: "var(--brand)" }} />}
                </button>
              );
            })}
          </div>
          <Mensaje mensaje={errores.responsable} />
          <div className="space-y-1.5">
            <Label htmlFor="vinculoExistente">Vínculo con el alumno</Label>
            <Select id="vinculoExistente" value={vinculoExistente} onChange={(e) => setVinculoExistente(e.target.value as VinculoDeOtraPersona)}>
              <option value="" disabled>
                Elegir…
              </option>
              {VINCULOS_DE_OTRA_PERSONA.map((v) => (
                <option key={v} value={v}>
                  {VINCULO_LABELS[v]}
                </option>
              ))}
            </Select>
            <Mensaje mensaje={errores.vinculo} />
          </div>
          {dniParaCompletar && (
            <p className="text-[12px]" style={{ color: "var(--brand)" }}>
              Se le va a completar el DNI a esa ficha ({formatDni(dniParaCompletar.dni)}).
            </p>
          )}
          {hermanos.length > 0 && (
            <div className="flex items-start gap-2 rounded-md border p-3" style={{ background: "var(--brand-soft)", borderColor: "var(--brand-border)" }}>
              <p className="text-[12.5px]" style={{ color: "var(--brand)" }}>
                Este responsable ya tiene {hermanos.length} alumno{hermanos.length !== 1 ? "s" : ""} inscripto{hermanos.length !== 1 ? "s" : ""} (
                {hermanos.map((h) => h.nombre).join(", ")}). Se aplicará <strong>descuento del 10%</strong> sobre la cuota de este alumno.
              </p>
            </div>
          )}
        </div>
      )}

      {modo === "nuevo" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="responsableNombre">Nombre</Label>
              <Input id="responsableNombre" {...nuevo.register("nombre")} />
              <Mensaje mensaje={nuevo.formState.errors.nombre?.message} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="responsableApellido">Apellido</Label>
              <Input id="responsableApellido" {...nuevo.register("apellido")} />
              <Mensaje mensaje={nuevo.formState.errors.apellido?.message} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="responsableTelefono">Celular (WhatsApp)</Label>
              <Input id="responsableTelefono" placeholder="351 555-1234" {...nuevo.register("telefono")} />
              <Mensaje mensaje={nuevo.formState.errors.telefono?.message} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="responsableVinculo">Vínculo con el alumno</Label>
              <Select id="responsableVinculo" defaultValue="" {...nuevo.register("vinculo")}>
                <option value="" disabled>
                  Elegir…
                </option>
                {VINCULOS_DE_OTRA_PERSONA.map((v) => (
                  <option key={v} value={v}>
                    {VINCULO_LABELS[v]}
                  </option>
                ))}
              </Select>
              <Mensaje mensaje={nuevo.formState.errors.vinculo?.message} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="responsableDni">
                DNI <span style={{ color: "var(--text-faint)", fontWeight: 400 }}>· opcional</span>
              </Label>
              <Input id="responsableDni" placeholder="28456123" {...nuevo.register("dni")} />
              <Mensaje mensaje={nuevo.formState.errors.dni?.message} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="responsableEmail">
                Email <span style={{ color: "var(--text-faint)", fontWeight: 400 }}>· opcional</span>
              </Label>
              <Input id="responsableEmail" type="email" {...nuevo.register("email")} />
              <p className="text-[11px]" style={{ color: "var(--text-faint)" }}>
                Es un dato de contacto: el acceso al sistema lo crea la administración
              </p>
              <Mensaje mensaje={nuevo.formState.errors.email?.message} />
            </div>
          </div>
        </div>
      )}

      {modo === "propio" && (
        <div className="space-y-4">
          <p className="text-[12.5px]" style={{ color: "var(--text-muted)" }}>
            Se crea su ficha de responsable con sus mismos datos (nombre, apellido y DNI). Solo hace falta su celular.
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="propioTelefono">Celular (WhatsApp)</Label>
              <Input id="propioTelefono" placeholder="351 555-1234" value={propio.telefono} onChange={(e) => setPropio((p) => ({ ...p, telefono: e.target.value }))} />
              <Mensaje mensaje={errores.telefono} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="propioEmail">
                Email <span style={{ color: "var(--text-faint)", fontWeight: 400 }}>· opcional</span>
              </Label>
              <Input id="propioEmail" type="email" value={propio.email} onChange={(e) => setPropio((p) => ({ ...p, email: e.target.value }))} />
              <p className="text-[11px]" style={{ color: "var(--text-faint)" }}>
                Es un dato de contacto: el acceso al sistema lo crea la administración
              </p>
              <Mensaje mensaje={errores.email} />
            </div>
          </div>
        </div>
      )}

      {fichaPorDni && (
        <div role="alert" data-ficha-por-dni className="space-y-2 rounded-md border p-3" style={{ background: "var(--warning-soft)", borderColor: "var(--warning)" }}>
          <p className="text-[12.5px]">
            Ya existe una ficha con ese DNI: <strong>{ficha(fichaPorDni)}</strong>. Se va a usar esa ficha y el alumno va a figurar con el nombre de la ficha.
          </p>
          {!nombreCoincide && (
            <>
              <p className="text-[12.5px] font-medium">
                El nombre no coincide con el del alumno ({alumno.nombre} {alumno.apellido}): revisá que el DNI esté bien.
              </p>
              <Button type="button" size="sm" variant={fichaConfirmada === fichaPorDni.id ? "default" : "outline"} onClick={() => setFichaConfirmada(fichaPorDni.id)}>
                {fichaConfirmada === fichaPorDni.id ? "✓ Es la misma persona" : "Es la misma persona"}
              </Button>
              <Mensaje mensaje={errores.fichaPorDni} />
            </>
          )}
        </div>
      )}

      {coincidentes.length > 0 && (
        <div role="alert" data-ficha-coincide className="space-y-2 rounded-md border p-3" style={{ background: "var(--warning-soft)", borderColor: "var(--warning)" }}>
          <p className="text-[12.5px] font-medium">Ese responsable ya está registrado. Usá su ficha en lugar de crear otra.</p>
          {coincidentes.map(({ ficha: f, motivos }) => {
            const hijos = hijosDe(f.id);
            return (
              <div key={f.id} data-coincidente={f.id} className="flex flex-wrap items-center gap-2 text-[12.5px]">
                <div className="min-w-0 flex-1">
                  <p>{ficha(f)}</p>
                  <p className="text-[11.5px]" style={{ color: "var(--text-muted)" }}>
                    Coincide el {textoDeMotivos(motivos)} ·{" "}
                    {hijos.length > 0 ? `hijos: ${hijos.map((h) => `${h.nombre} ${h.apellido}`).join(", ")}` : "todavía sin alumnos inscriptos"}
                  </p>
                </div>
                <Button type="button" size="sm" data-usar-ficha onClick={() => usarFicha(f)}>
                  Usar esa ficha
                </Button>
              </div>
            );
          })}
          <Mensaje mensaje={errores.coincidentes} />
        </div>
      )}

      {parecidas.length > 0 && (
        <div role="alert" data-fichas-parecidas className="space-y-2 rounded-md border p-3" style={{ background: "var(--warning-soft)", borderColor: "var(--warning)" }}>
          <p className="text-[12.5px] font-medium">
            Ya hay {parecidas.length === 1 ? "una ficha parecida" : "fichas parecidas"}. ¿Es la misma persona?
          </p>
          {parecidas.map((f) => (
            <div key={f.id} className="flex flex-wrap items-center gap-2 text-[12.5px]">
              <span className="flex-1">{ficha(f)}</span>
              {modo === "nuevo" || puedeUsarFichaPropia(f) ? (
                <Button type="button" size="sm" variant="outline" onClick={() => usarFicha(f)}>
                  Usar esa ficha
                </Button>
              ) : (
                <span className="text-[11.5px]" style={{ color: "var(--text-muted)" }}>
                  {alumno.dni ? "Esa ficha tiene otro DNI" : "Para usarla, cargá primero el DNI del alumno"}
                </span>
              )}
            </div>
          ))}
          <Button type="button" size="sm" variant={decidido ? "default" : "outline"} onClick={() => setDecision({ clave })}>
            {decidido ? "✓ Es otra persona" : "Es otra persona"}
          </Button>
          <Mensaje mensaje={errores.parecidas} />
        </div>
      )}
    </div>
  );
}

const normalizarDniSimple = (dni: string | undefined) => (dni ?? "").replace(/\D/g, "");

const TEXTO_DE_MOTIVO: Record<MotivoDeCoincidencia, string> = { dni: "DNI", celular: "celular", email: "email" };
const textoDeMotivos = (motivos: MotivoDeCoincidencia[]) => motivos.map((m) => TEXTO_DE_MOTIVO[m]).join(", ").replace(/, ([^,]*)$/, " y $1");
