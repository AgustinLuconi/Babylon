import { textoDelCambio } from "../../client/src/features/cambios/mensajes";
import type { SenalCambio } from "../../client/src/features/cambios/types";
import { ok } from "./_check";

const lucia = { usuarioId: "u1", nombre: "Lucía Peralta", rol: "secretario" as const };
const nombres = {
  alumno: (id: string) => ({ a1: "Tomás Rodríguez", a2: "Ana Gómez" })[id] ?? null,
  mesDeCuota: (id: string) => ({ c1: "octubre" })[id] ?? null,
};
const sinNombres = { alumno: () => null, mesDeCuota: () => null };
const t = (s: Omit<SenalCambio, "por"> & { por?: SenalCambio["por"] }, n = nombres) => textoDelCambio({ por: lucia, ...s } as SenalCambio, n);

ok("cobro de una cuota", t({ dato: "cuotas", accion: "cobro", ids: { alumnoIds: ["a1"], cuotaIds: ["c1"] } }), "Lucía cobró la cuota de octubre de Tomás Rodríguez");
ok("cobro sin nombres en caché", t({ dato: "cuotas", accion: "cobro", ids: { alumnoIds: ["a1"], cuotaIds: ["c1"] } }, sinNombres), "Lucía cobró una cuota");
ok("cobro de varias", t({ dato: "cuotas", accion: "cobro", ids: { alumnoIds: ["a1", "a2"], cuotaIds: ["c1", "c2", "c3"] } }), "Lucía cobró 3 cuotas");
ok("vencimiento (el sistema)", t({ dato: "cuotas", accion: "vencimiento", ids: { cuotaIds: ["c1", "c2", "c3", "c4"] }, por: null }), "Se marcaron vencidas 4 cuotas");
ok("inscripción", t({ dato: "alumnos", accion: "inscripcion", ids: { alumnoIds: ["a1"] } }), "Lucía inscribió a Tomás Rodríguez");
ok("cambio de curso", t({ dato: "alumnos", accion: "cambio-curso", ids: { alumnoIds: ["a1"] } }), "Lucía cambió de curso a Tomás Rodríguez");
ok("baja", t({ dato: "alumnos", accion: "baja", ids: { alumnoIds: ["a2"] } }), "Lucía dio de baja a Ana Gómez");
ok("descuento por hermanos de un alumno", t({ dato: "alumnos", accion: "descuento", ids: { alumnoIds: ["a2"] } }), "Lucía cambió el descuento por hermanos de Ana Gómez");
ok("descuento por hermanos de varios", t({ dato: "alumnos", accion: "descuento", ids: { alumnoIds: ["a1", "a2"] } }), "Lucía cambió el descuento por hermanos de 2 alumnos");
ok("descuento sin nombre en caché", t({ dato: "alumnos", accion: "descuento", ids: { alumnoIds: ["a1"] } }, sinNombres), "Lucía cambió el descuento por hermanos de un alumno");
ok("publicación de evaluación", t({ dato: "evaluaciones", accion: "publicacion", ids: {}, por: { usuarioId: "u2", nombre: "Martín Sosa", rol: "profesor" } }), "Martín publicó una evaluación");
ok("carga de notas", t({ dato: "calificaciones", accion: "carga", ids: {}, por: { usuarioId: "u2", nombre: "Martín Sosa", rol: "profesor" } }), "Martín cargó notas");
ok("notas de cierre publicadas", t({ dato: "notas-cierre", accion: "publicacion", ids: { alumnoIds: Array.from({ length: 28 }, (_, i) => `x${i}`) }, por: { usuarioId: "u2", nombre: "Martín Sosa", rol: "profesor" } }), "Martín publicó las notas de cierre de 28 alumnos");
ok("asistencia", t({ dato: "asistencia", accion: "registro", ids: {}, por: { usuarioId: "u2", nombre: "Martín Sosa", rol: "profesor" } }), "Martín tomó asistencia");
ok("observación", t({ dato: "observaciones", accion: "alta", ids: { alumnoIds: ["a1"] } }), "Lucía escribió una observación sobre Tomás Rodríguez");
ok("sin autor y sin texto impersonal", t({ dato: "cursos", accion: "edicion", ids: {}, por: null }), "El sistema modificó un curso");
ok("sesiones: sin mensaje", t({ dato: "sesiones", accion: "inicio", ids: {} }), null);
