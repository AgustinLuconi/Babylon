// Traduce el texto libre de la columna "Documentación" del roster real a un
// estado por cada uno de los 3 tipos de Documento. Los valores reales
// observados en las 19 hojas del maestro son: "COMPLETA", "FALTA FICHA",
// "FALTA DNI"/"DEBE DNI"/variantes de mayúsculas, "FALTA IMAGEN",
// "FALTA TODO"/"DEBE TODO", "DNI" (sola, ambigua) y al menos un valor
// anómalo ("Terminaron Unit 1-5", claramente una nota académica mal
// ubicada en esta columna). Heurística aplicada, a revisar manualmente
// donde el texto no calce con ninguno de los patrones esperados:
//   - Si menciona "TODO" -> los 3 pendientes.
//   - Si menciona "FICHA" -> formulario_inscripcion pendiente, el resto completo.
//   - Si menciona "IMAGEN" -> autorizacion_imagen pendiente, el resto completo.
//   - Si menciona "DNI" junto con "FALTA"/"DEBE" -> copia_dni pendiente, el resto completo.
//   - Cualquier otro texto (incl. "COMPLETA", "DNI" sola, o algo irreconocible) -> los 3 completos.
export interface EstadoDocumentosImportados {
  formularioCompleto: boolean;
  dniCompleto: boolean;
  imagenCompleta: boolean;
  ambiguo: boolean; // true cuando el texto no calzó con ningún patrón esperado — revisar a mano
}

export function mapearDocumentacion(texto: string | null): EstadoDocumentosImportados {
  if (!texto) {
    return { formularioCompleto: true, dniCompleto: true, imagenCompleta: true, ambiguo: false };
  }

  const t = texto.toUpperCase();
  const faltaODebe = t.includes("FALTA") || t.includes("DEBE");

  if (t.includes("TODO")) {
    return { formularioCompleto: false, dniCompleto: false, imagenCompleta: false, ambiguo: false };
  }
  if (t.includes("FICHA")) {
    return { formularioCompleto: false, dniCompleto: true, imagenCompleta: true, ambiguo: false };
  }
  if (t.includes("IMAGEN")) {
    return { formularioCompleto: true, dniCompleto: false, imagenCompleta: true, ambiguo: false };
  }
  if (t.includes("DNI") && faltaODebe) {
    return { formularioCompleto: true, dniCompleto: false, imagenCompleta: true, ambiguo: false };
  }
  if (t === "COMPLETA") {
    return { formularioCompleto: true, dniCompleto: true, imagenCompleta: true, ambiguo: false };
  }

  // "DNI" sola, o cualquier texto no reconocido (ej. una nota académica
  // que quedó pegada en esta columna por error de tipeo en la planilla
  // original) — se asume todo completo pero se marca `ambiguo` para que el
  // resumen final del import lo liste como pendiente de revisión manual.
  return { formularioCompleto: true, dniCompleto: true, imagenCompleta: true, ambiguo: true };
}
