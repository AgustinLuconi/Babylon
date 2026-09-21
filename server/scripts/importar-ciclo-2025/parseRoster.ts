import * as XLSX from "xlsx";

export interface FilaRoster {
  numero: number;
  apellido: string;
  nombre: string;
  dni: string;
  // Puede faltar en la fuente real (ej. una fila cargada a medias) — no se
  // fabrica una fecha, se deja null y el importador salta ese alumno.
  fechaNacimiento: Date | null;
  documentacionTexto: string | null;
  telefono?: string;
  insc2026: boolean;
}

// El roster real siempre tiene estas columnas en este orden exacto (ver
// header en cada hoja del maestro "Ciclo 2025_.xlsx"):
// Nº | Apellido y Nombre | Nº DNI | Fecha Nac. | Documentación | Tel.
// Contacto | Mat. 2025 | Mar..Nov (9 meses) | Exa. | Insc. 2026
const COL = {
  numero: 0,
  apellidoNombre: 1,
  dni: 2,
  fechaNac: 3,
  documentacion: 4,
  telefono: 5,
  insc2026: 17,
};

function limpiarDni(valor: unknown): string {
  return String(valor ?? "").replace(/\D/g, "");
}

// La planilla guarda "APELLIDO(S), Nombre(s)" en una sola celda — se separa
// por la primera coma. Si no hay coma (caso raro), todo queda como apellido.
function separarApellidoNombre(valor: string): { apellido: string; nombre: string } {
  const idx = valor.indexOf(",");
  if (idx === -1) return { apellido: valor.trim(), nombre: "" };
  return { apellido: valor.slice(0, idx).trim(), nombre: valor.slice(idx + 1).trim() };
}

export function parseRoster(workbook: XLSX.WorkBook, sheetName: string): FilaRoster[] {
  const hoja = workbook.Sheets[sheetName];
  if (!hoja) throw new Error(`No existe la hoja "${sheetName}" en el workbook`);

  const filas: unknown[][] = XLSX.utils.sheet_to_json(hoja, { header: 1, raw: true, defval: null });

  const headerIdx = filas.findIndex((f) => f[COL.numero] === "Nº");
  if (headerIdx === -1) throw new Error(`No se encontró la fila de encabezado en "${sheetName}"`);

  const resultado: FilaRoster[] = [];
  for (const fila of filas.slice(headerIdx + 1)) {
    const numero = fila[COL.numero];
    const apellidoNombre = fila[COL.apellidoNombre];
    // Corta en la primera fila sin nombre o sin número — así se excluyen
    // filas de formato tipo "Vuelta a Horario"/"Observaciones:" que
    // aparecen después de la nómina real en algunas hojas.
    if (typeof numero !== "number" || !apellidoNombre) break;

    const { apellido, nombre } = separarApellidoNombre(String(apellidoNombre));
    const fechaNac = fila[COL.fechaNac];
    const telefono = fila[COL.telefono] ? String(fila[COL.telefono]).trim() : undefined;

    resultado.push({
      numero,
      apellido,
      nombre,
      dni: limpiarDni(fila[COL.dni]),
      fechaNacimiento: fechaNac instanceof Date ? fechaNac : null,
      documentacionTexto: fila[COL.documentacion] ? String(fila[COL.documentacion]).trim() : null,
      telefono,
      insc2026: fila[COL.insc2026] === "P",
    });
  }

  return resultado;
}
