import type { Documento, TipoDocumento } from "./documento.entity";

export const TIPOS_DOCUMENTO: TipoDocumento[] = ["formulario_inscripcion", "copia_dni", "autorizacion_imagen"];

// Alumno que debe documentación (activo e inscripto en el ciclo activo) con lo que le falta.
export interface AlumnoConFaltantes {
  alumnoId: string;
  nombre: string;
  padreId: string | null;
  faltan: TipoDocumento[];
}

// Criterio único de documentación pendiente (avisos, panel de la secretaria y filtro de Alumnos): la autorización de
// imagen tiene que estar "autorizado" y el formulario y la copia del DNI "cargado"; no tener la fila también es pendiente.
export function documentosFaltantes(documentos: Pick<Documento, "tipo" | "estado">[]): TipoDocumento[] {
  const estadoDe = (tipo: TipoDocumento) => documentos.find((d) => d.tipo === tipo)?.estado;
  return TIPOS_DOCUMENTO.filter((tipo) =>
    tipo === "autorizacion_imagen" ? estadoDe(tipo) !== "autorizado" : estadoDe(tipo) !== "cargado",
  );
}
