import { normalizarTexto } from "../../core/lib/utils";

// Fichas de responsable que podrían ser la misma persona que la que se está por cargar: mismo nombre y mismo apellido
// (sin tildes, mayúsculas ni espacios de más), o uno contenido en el otro palabra por palabra ("María" y "María José").
// Es una ayuda para no duplicar fichas: la decisión la toma quien carga. Sin dependencias de pantallas (se prueba desde
// server/tests/, por eso importa con rutas relativas).
const palabras = (texto: string) => normalizarTexto(texto).split(/\s+/).filter(Boolean);
const contenido = (a: string[], b: string[]) => a.every((p) => b.includes(p));
const parecidas = (a: string, b: string) => {
  const x = palabras(a);
  const y = palabras(b);
  return x.length > 0 && y.length > 0 && (contenido(x, y) || contenido(y, x));
};

export function fichasParecidas<P extends { nombre: string; apellido: string }>(nuevo: { nombre: string; apellido: string }, existentes: P[]): P[] {
  if (palabras(nuevo.nombre).length === 0 || palabras(nuevo.apellido).length === 0) return [];
  return existentes.filter((f) => parecidas(nuevo.nombre, f.nombre) && parecidas(nuevo.apellido, f.apellido));
}
