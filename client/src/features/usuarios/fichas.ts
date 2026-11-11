import { celularSchema, dniSchema, textoRequerido } from "@/core/lib/validacion";
import type { FichaDePadre, FichaDeProfesor } from "./types";

// Lo que se eligió en el selector de ficha: una que ya existe (sin cuenta) o los datos de una nueva.
export type FichaElegida =
  | { modo: "existente"; fichaId: string }
  | { modo: "nueva"; nombre: string; apellido: string; telefono: string; dni: string };

export type FichaNueva = Extract<FichaElegida, { modo: "nueva" }>;
export const FICHA_NUEVA_VACIA: FichaNueva = { modo: "nueva", nombre: "", apellido: "", telefono: "", dni: "" };

type Resultado<T> = { ok: true; ref: T } | { ok: false; errores: Record<string, string> };

// Valida lo elegido y lo arma como lo pide la API. Los errores van por campo ("nombre", "apellido", "telefono", "dni", "ficha").
export function fichaParaEnviar(tipo: "padre", valor: FichaElegida): Resultado<FichaDePadre>;
export function fichaParaEnviar(tipo: "profesor", valor: FichaElegida): Resultado<FichaDeProfesor>;
export function fichaParaEnviar(tipo: "padre" | "profesor", valor: FichaElegida): Resultado<FichaDePadre | FichaDeProfesor> {
  if (valor.modo === "existente") {
    return valor.fichaId ? { ok: true, ref: { fichaId: valor.fichaId } } : { ok: false, errores: { ficha: "Elegí una ficha" } };
  }
  const errores: Record<string, string> = {};
  const nombre = textoRequerido("El nombre", 60).safeParse(valor.nombre);
  const apellido = textoRequerido("El apellido", 60).safeParse(valor.apellido);
  if (!nombre.success) errores.nombre = nombre.error.issues[0].message;
  if (!apellido.success) errores.apellido = apellido.error.issues[0].message;
  if (tipo === "padre") {
    const telefono = celularSchema.safeParse(valor.telefono);
    if (!telefono.success) errores.telefono = valor.telefono.trim() ? telefono.error.issues[0].message : "El celular es requerido";
    if (Object.keys(errores).length > 0 || !nombre.success || !apellido.success || !telefono.success) return { ok: false, errores };
    return { ok: true, ref: { nueva: { nombre: nombre.data, apellido: apellido.data, telefono: telefono.data } } };
  }
  const dni = dniSchema.safeParse(valor.dni);
  if (!dni.success) errores.dni = valor.dni.trim() ? dni.error.issues[0].message : "El DNI es requerido";
  const telefono = valor.telefono.trim() ? celularSchema.safeParse(valor.telefono) : null;
  if (telefono && !telefono.success) errores.telefono = telefono.error.issues[0].message;
  if (Object.keys(errores).length > 0 || !nombre.success || !apellido.success || !dni.success) return { ok: false, errores };
  return { ok: true, ref: { nueva: { nombre: nombre.data, apellido: apellido.data, dni: dni.data, ...(telefono?.success ? { telefono: telefono.data } : {}) } } };
}

export const ETIQUETA_FICHA = { padre: "responsable", profesor: "profesor" } as const;
