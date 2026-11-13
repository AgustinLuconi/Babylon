import { normalizarTexto } from "../../core/lib/utils";
import { normalizarCelular, normalizarDni, normalizarEmail } from "../../core/lib/validacion";

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

// Fichas que ya tienen el mismo DNI, celular o email que se está escribiendo: casi seguro es la misma persona (un DNI
// no se repite; un celular o un email compartido entre dos responsables se resuelve cargando otro dato de contacto).
// Se compara lo normalizado (un DNI con puntos, un celular escrito de otra forma, un email en mayúsculas) y lo que todavía
// no se escribió o no es válido no coincide con nada. Una ficha con varios motivos aparece una sola vez.
export type MotivoDeCoincidencia = "dni" | "celular" | "email";
export interface FichaCoincidente<P> {
  ficha: P;
  motivos: MotivoDeCoincidencia[];
}

interface FichaConContacto {
  dni?: string | null;
  telefono?: string | null;
  email?: string | null;
}

export function fichasCoincidentes<P extends FichaConContacto>(
  nuevo: { dni?: string; telefono?: string; email?: string },
  existentes: P[],
): FichaCoincidente<P>[] {
  const dni = nuevo.dni?.trim() ? normalizarDni(nuevo.dni) : null;
  const celular = nuevo.telefono?.trim() ? normalizarCelular(nuevo.telefono) : null;
  const email = nuevo.email?.trim() && nuevo.email.includes("@") ? normalizarEmail(nuevo.email) : null;
  const resultado: FichaCoincidente<P>[] = [];
  for (const ficha of existentes) {
    const motivos: MotivoDeCoincidencia[] = [];
    if (dni && ficha.dni && normalizarDni(ficha.dni) === dni) motivos.push("dni");
    if (celular && ficha.telefono && normalizarCelular(ficha.telefono) === celular) motivos.push("celular");
    if (email && ficha.email && normalizarEmail(ficha.email) === email) motivos.push("email");
    if (motivos.length > 0) resultado.push({ ficha, motivos });
  }
  return resultado;
}
