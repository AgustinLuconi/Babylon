// Lo que le falta a un alumno para tener su ficha completa (igual a `DatoFaltante` del servidor).
export type DatoFaltante = "dni" | "fechaNacimiento" | "responsable" | "vinculo" | "responsableDni" | "responsableTelefono" | "responsableEmail";

export const ETIQUETA_FALTANTE: Record<DatoFaltante, string> = {
  dni: "DNI",
  fechaNacimiento: "Fecha de nacimiento",
  responsable: "Responsable",
  vinculo: "Vínculo con el responsable",
  responsableDni: "DNI del responsable",
  responsableTelefono: "Celular del responsable",
  responsableEmail: "Email del responsable",
};

export const textoIncompleto = (faltan: DatoFaltante[]): string => faltan.map((f) => ETIQUETA_FALTANTE[f]).join(", ");
