import { useMemo, useState } from "react";
import { z } from "zod";
import { AvisoDeCambioAjeno } from "@/core/formularios/AvisoDeCambioAjeno";
import { useFormularioAlDia } from "@/core/formularios/useFormularioAlDia";
import { Button } from "@/core/components/ui/button";
import { Input } from "@/core/components/ui/input";
import { Label } from "@/core/components/ui/label";
import { Modal } from "@/core/components/ui/modal";
import { cambiosParaEnviar, hayCambios } from "@/core/lib/diferencias";
import { erroresDeCampo } from "@/core/lib/erroresDeCampo";
import { hoyLocalISO } from "@/core/lib/utils";
import { fechaNacimientoValida, normalizarCelular, normalizarDni, normalizarEmail } from "@/core/lib/validacion";
import { useSinGuardar } from "@/core/sinGuardar/sinGuardar";
import { useActualizarPadre } from "@/features/padres/hooks/useActualizarPadre";
import type { ActualizarPadreInput, Padre } from "@/features/padres/types";
import { useActualizarAlumno } from "../hooks/useActualizarAlumno";
import type { ActualizarAlumnoInput, Alumno } from "../types";

// Editar los datos de un alumno y de su responsable. Al guardar se manda solo lo que cambió; las validaciones corren solo
// sobre lo que se modificó (un dato viejo que no se toca nunca bloquea el guardado); y si otra persona cambia el mismo
// registro mientras tanto, lo que no se tocó se actualiza solo y un aviso lo explica.
interface CampoDef {
  clave: string;
  etiqueta: string;
  tipo?: "text" | "date" | "email";
  mono?: boolean;
  obligatorio?: string; // mensaje cuando se vacía un campo obligatorio
  validar?: (valor: string) => string | null;
  ancho?: boolean;
}

const maximo = (n: number) => (v: string) => (v.trim().length > n ? `Admite hasta ${n} caracteres` : null);
const dniValido = (v: string) => (normalizarDni(v) ? null : "El DNI no es válido: tiene que tener 7 u 8 números");
const celularValido = (v: string) => (normalizarCelular(v) ? null : "El celular no es válido: escribilo con el código de área, por ejemplo 351 555-1234");
const emailValido = (v: string) => (z.email().safeParse(normalizarEmail(v)).success ? null : "Email inválido");
const fechaValida = (v: string) =>
  fechaNacimientoValida(v.trim(), hoyLocalISO()) ? null : "La fecha de nacimiento no es válida: tiene que ser una fecha real, de una persona de entre 2 y 100 años";
const nombreValido = (v: string) => maximo(60)(v);

const CAMPOS_ALUMNO: CampoDef[] = [
  { clave: "nombre", etiqueta: "Nombre", obligatorio: "El nombre es requerido", validar: nombreValido },
  { clave: "apellido", etiqueta: "Apellido", obligatorio: "El apellido es requerido", validar: nombreValido },
  { clave: "dni", etiqueta: "DNI", mono: true, validar: dniValido },
  { clave: "fechaNacimiento", etiqueta: "Fecha de nacimiento", tipo: "date", validar: fechaValida },
  { clave: "direccion", etiqueta: "Dirección", validar: maximo(150), ancho: true },
  { clave: "telefono", etiqueta: "Celular del alumno", validar: celularValido },
  { clave: "email", etiqueta: "Email", tipo: "email", validar: emailValido },
  { clave: "observacionesMedicas", etiqueta: "Obs. médicas / alergias", validar: maximo(1000), ancho: true },
];
const CAMPOS_PADRE: CampoDef[] = [
  { clave: "nombre", etiqueta: "Nombre", obligatorio: "El nombre es requerido", validar: nombreValido },
  { clave: "apellido", etiqueta: "Apellido", obligatorio: "El apellido es requerido", validar: nombreValido },
  { clave: "dni", etiqueta: "DNI", mono: true, validar: dniValido },
  { clave: "direccion", etiqueta: "Dirección", validar: maximo(150) },
  { clave: "telefono", etiqueta: "Celular", obligatorio: "El celular es requerido", validar: celularValido },
  { clave: "email", etiqueta: "Email", tipo: "email", validar: emailValido },
];
// Lo que se puede completar después se puede volver a vaciar; lo obligatorio al crear, no.
const BORRABLES_ALUMNO = ["dni", "fechaNacimiento", "direccion", "telefono", "email", "observacionesMedicas"] as const;
const BORRABLES_PADRE = ["dni", "direccion", "email"] as const;

const aFormAlumno = (a: Alumno) => ({
  nombre: a.nombre,
  apellido: a.apellido,
  dni: a.dni ?? "",
  fechaNacimiento: a.fechaNacimiento?.slice(0, 10) ?? "",
  direccion: a.direccion ?? "",
  telefono: a.telefono ?? "",
  email: a.email ?? "",
  observacionesMedicas: a.observacionesMedicas ?? "",
});
const aFormPadre = (p: Padre) => ({
  nombre: p.nombre,
  apellido: p.apellido,
  dni: p.dni ?? "",
  direccion: p.direccion ?? "",
  telefono: p.telefono ?? "",
  email: p.email ?? "",
});
type FormAlumno = ReturnType<typeof aFormAlumno>;
type FormPadre = ReturnType<typeof aFormPadre>;
const PADRE_VACIO: FormPadre = { nombre: "", apellido: "", dni: "", direccion: "", telefono: "", email: "" };

const ETIQUETAS_ALUMNO: Record<keyof FormAlumno, string> = {
  nombre: "nombre",
  apellido: "apellido",
  dni: "DNI",
  fechaNacimiento: "fecha de nacimiento",
  direccion: "dirección",
  telefono: "celular",
  email: "email",
  observacionesMedicas: "observaciones médicas",
};
const ETIQUETAS_PADRE: Record<keyof FormPadre, string> = {
  nombre: "nombre del responsable",
  apellido: "apellido del responsable",
  dni: "DNI del responsable",
  direccion: "dirección del responsable",
  telefono: "celular del responsable",
  email: "email del responsable",
};

// Validaciones solo de lo modificado; un campo obligatorio que se vació se avisa siempre.
function validar(campos: CampoDef[], valores: Record<string, string>, base: Record<string, string>, cambios: Record<string, unknown>) {
  const errores: Record<string, string> = {};
  for (const c of campos) {
    if (c.obligatorio && valores[c.clave].trim() === "" && base[c.clave].trim() !== "") errores[c.clave] = c.obligatorio;
    else if (typeof cambios[c.clave] === "string" && c.validar) {
      const mensaje = c.validar(cambios[c.clave] as string);
      if (mensaje) errores[c.clave] = mensaje;
    }
  }
  return errores;
}

export function EditarDatosModal({ alumno, padre, onClose, onGuardado }: { alumno: Alumno; padre?: Padre; onClose: () => void; onGuardado: (mensaje: string) => void }) {
  const actualizarAlumno = useActualizarAlumno();
  const actualizarPadre = useActualizarPadre();
  // Un alumno que es responsable de sí mismo: nombre, apellido y DNI son los mismos en su ficha.
  const esPropio = alumno.vinculoResponsable === "propio";

  const servidorAlumno = useMemo(() => aFormAlumno(alumno), [alumno]);
  const servidorPadre = useMemo(() => (padre ? aFormPadre(padre) : undefined), [padre]);
  const [valoresAlumno, setValoresAlumno] = useState(servidorAlumno);
  const [valoresPadre, setValoresPadre] = useState(servidorPadre ?? PADRE_VACIO);
  const alDiaAlumno = useFormularioAlDia<FormAlumno>({
    activo: true,
    dato: "alumnos",
    claveDeId: "alumnoIds",
    id: alumno.id,
    servidor: servidorAlumno,
    etiquetas: ETIQUETAS_ALUMNO,
    valores: valoresAlumno,
    aplicar: (parcial) => setValoresAlumno((v) => ({ ...v, ...parcial })),
  });
  const alDiaPadre = useFormularioAlDia<FormPadre>({
    activo: padre !== undefined,
    dato: "padres",
    claveDeId: "padreIds",
    id: padre?.id ?? "",
    servidor: servidorPadre,
    etiquetas: ETIQUETAS_PADRE,
    valores: valoresPadre,
    aplicar: (parcial) => setValoresPadre((v) => ({ ...v, ...parcial })),
  });

  const baseAlumno = alDiaAlumno.base ?? servidorAlumno;
  const basePadre = alDiaPadre.base ?? servidorPadre ?? PADRE_VACIO;
  const cambiosAlumno = cambiosParaEnviar(valoresAlumno, baseAlumno, BORRABLES_ALUMNO);
  const cambiosPadre = padre ? cambiosParaEnviar(valoresPadre, basePadre, BORRABLES_PADRE) : {};
  const sinGuardar = hayCambios(cambiosAlumno) || hayCambios(cambiosPadre);
  useSinGuardar(sinGuardar);

  const [erroresAlumno, setErroresAlumno] = useState<Record<string, string>>({});
  const [erroresPadre, setErroresPadre] = useState<Record<string, string>>({});
  const [general, setGeneral] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const guardar = async () => {
    setGeneral(null);
    const ea = validar(CAMPOS_ALUMNO, valoresAlumno, baseAlumno, cambiosAlumno);
    const ep = padre ? validar(CAMPOS_PADRE, valoresPadre, basePadre, cambiosPadre) : {};
    setErroresAlumno(ea);
    setErroresPadre(ep);
    if (Object.keys(ea).length > 0 || Object.keys(ep).length > 0) return;
    if (!sinGuardar) {
      setGeneral("No hay cambios para guardar");
      return;
    }
    setGuardando(true);
    let fallo: "alumno" | "responsable" = "alumno";
    try {
      if (hayCambios(cambiosAlumno)) await actualizarAlumno.mutateAsync({ id: alumno.id, datos: cambiosAlumno as ActualizarAlumnoInput });
      fallo = "responsable";
      if (padre && hayCambios(cambiosPadre)) await actualizarPadre.mutateAsync({ id: padre.id, datos: cambiosPadre as ActualizarPadreInput });
      onGuardado("Datos actualizados");
    } catch (error) {
      const { campos, general: mensaje } = erroresDeCampo(error);
      if (fallo === "alumno") setErroresAlumno(campos);
      else setErroresPadre(campos);
      setGeneral(mensaje);
    } finally {
      setGuardando(false);
    }
  };

  const dibujar = (
    campos: CampoDef[],
    valores: Record<string, string>,
    cambiar: (clave: string, valor: string) => void,
    errores: Record<string, string>,
    resaltados: ReadonlySet<string>,
    prefijo: string,
  ) => (
    <div className="grid grid-cols-2 gap-3">
      {campos.map((c) => (
        <div key={c.clave} className={`space-y-1.5 ${c.ancho ? "col-span-2" : ""}`}>
          <Label htmlFor={`${prefijo}-${c.clave}`}>{c.etiqueta}</Label>
          <Input
            id={`${prefijo}-${c.clave}`}
            type={c.tipo ?? "text"}
            className={`${c.mono ? "font-mono" : ""} ${resaltados.has(c.clave) ? "cambio-resaltado" : ""}`}
            value={valores[c.clave]}
            onChange={(e) => cambiar(c.clave, e.target.value)}
          />
          {errores[c.clave] && <p className="text-sm text-destructive">{errores[c.clave]}</p>}
        </div>
      ))}
    </div>
  );

  return (
    <Modal
      title="Editar datos"
      sinGuardar={sinGuardar}
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" className="flex-1" onClick={onClose}>
            Cancelar
          </Button>
          <Button className="flex-1" disabled={guardando} onClick={guardar}>
            {guardando ? "Guardando..." : "Guardar cambios"}
          </Button>
        </>
      }
    >
      <AvisoDeCambioAjeno aviso={alDiaAlumno.aviso} onCerrar={alDiaAlumno.descartarAviso} />
      <AvisoDeCambioAjeno aviso={alDiaPadre.aviso} onCerrar={alDiaPadre.descartarAviso} />
      <div className="space-y-3">
        <p className="text-[12.5px] font-semibold">Datos del alumno</p>
        {dibujar(CAMPOS_ALUMNO, valoresAlumno, (k, v) => setValoresAlumno((x) => ({ ...x, [k]: v })), erroresAlumno, alDiaAlumno.resaltados as ReadonlySet<string>, "alumno")}
      </div>
      {padre && (
        <div className="space-y-3 border-t pt-4" style={{ borderColor: "var(--border-hex)" }}>
          <p className="text-[12.5px] font-semibold">Datos del responsable</p>
          {esPropio && (
            <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>
              Es responsable de sí mismo: su nombre, apellido y DNI son los del alumno.
            </p>
          )}
          {dibujar(
            esPropio ? CAMPOS_PADRE.filter((c) => !["nombre", "apellido", "dni"].includes(c.clave)) : CAMPOS_PADRE,
            valoresPadre,
            (k, v) => setValoresPadre((x) => ({ ...x, [k]: v })),
            erroresPadre,
            alDiaPadre.resaltados as ReadonlySet<string>,
            "responsable",
          )}
        </div>
      )}
      {general && <p className="text-sm text-destructive">{general}</p>}
    </Modal>
  );
}
