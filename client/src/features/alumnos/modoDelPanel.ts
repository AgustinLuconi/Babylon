import type { EtiquetasDelPanel } from "../../core/components/layout/etiquetasDelPanel";
import type { VinculoPadre } from "../padres/types";

// El panel de una cuenta de responsable es el mismo para todos, pero sus textos y su selector cambian según las
// cursadas que tiene: una familia (hijos), un adulto solo (su propia cursada) o un adulto que además es responsable de
// otros (la propia más la de sus hijos). Sin dependencias de pantallas (se prueba desde server/tests/).
export type ModoDelPanel = "hijos" | "propio" | "mixto";

export function modoDelPanel(cursadas: { vinculoResponsable?: VinculoPadre }[]): ModoDelPanel {
  const propias = cursadas.filter((c) => c.vinculoResponsable === "propio").length;
  if (propias === 0) return "hijos";
  return propias === cursadas.length ? "propio" : "mixto";
}

const ETIQUETAS: Record<ModoDelPanel, EtiquetasDelPanel> = {
  hijos: {
    grupo: "Mi familia",
    menu: { resumen: "Resumen", notas: "Calificaciones", asistencia: "Asistencia", cuotas: "Cuotas", documentacion: "Documentación", chat: "Mensajes" },
    subtituloDocumentacion: "Legajo digital de tu hijo/a",
  },
  propio: {
    grupo: "Mi cursada",
    menu: { resumen: "Mi cursada", notas: "Mis notas", asistencia: "Mi asistencia", cuotas: "Mis cuotas", documentacion: "Mi documentación", chat: "Chat con el instituto" },
    subtituloDocumentacion: "Tu legajo digital",
  },
  mixto: {
    grupo: "Mi familia",
    menu: { resumen: "Cursadas", notas: "Calificaciones", asistencia: "Asistencia", cuotas: "Cuotas", documentacion: "Documentación", chat: "Mensajes" },
    subtituloDocumentacion: "Legajo digital de la cursada elegida",
  },
};

export const etiquetasDelPanel = (modo: ModoDelPanel): EtiquetasDelPanel => ETIQUETAS[modo];
