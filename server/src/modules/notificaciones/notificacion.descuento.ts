import type { CausaDescuento } from "../alumnos/alumno.hermanos";

export type { CausaDescuento };

const RIGE = " Rige desde la próxima cuota que se genere.";

interface DatosDelTexto {
  destinatario: "instituto" | "familia";
  alumno: string;
  // true: pasó a tener el 10%; false: pasó a pagar la cuota completa.
  aplica: boolean;
  causa: CausaDescuento;
  alumnoDeLaCausa: string | null;
  // Este alumno es el que provocó el cambio (cambió de familia o volvió a estar activo).
  esElQueSeMovio: boolean;
}

// Texto del aviso de que cambió el descuento por hermanos de un alumno. Para la familia nunca se nombra a un alumno
// que no es suyo: en un cambio de responsable, el hermano que se fue o llegó se cuenta sin nombre.
export function textoDeAvisoDeDescuento(d: DatosDelTexto): string {
  const efecto = d.aplica ? "pasó a tener 10% de descuento por hermanos" : "pasó a pagar la cuota completa";
  const quien = d.alumnoDeLaCausa ?? "otro alumno";
  switch (d.causa) {
    case "baja":
      return `${d.alumno} ${efecto} porque ${quien} se dio de baja.${RIGE}`;
    case "reactivacion":
      // Si el que volvió es el propio alumno (su marca se corrigió al reactivarlo), no se nombra a sí mismo.
      return d.esElQueSeMovio ? `${d.alumno} ${efecto} porque volvió a estar activo.${RIGE}` : `${d.alumno} ${efecto} porque ${quien} volvió a estar activo.${RIGE}`;
    case "cambio-responsable":
      if (d.esElQueSeMovio) return `${d.alumno} ${efecto} por el cambio de responsable.${RIGE}`;
      if (d.destinatario === "instituto") return `${d.alumno} ${efecto} porque ${quien} cambió de responsable.${RIGE}`;
      return d.aplica
        ? `${d.alumno} ${efecto} porque se sumó un hermano a tu cargo.${RIGE}`
        : `${d.alumno} ${efecto} porque un hermano dejó de estar a tu cargo.${RIGE}`;
  }
}
