// Reparte el error de un pedido entre los campos del formulario. El servidor responde 400 con `details` por campo (y,
// para lo anidado, también por ruta completa, ej. "responsable.datos.telefono"); un 409 por DNI repetido va al campo del
// DNI. Lo que no es de un campo queda como error general. Sin dependencias del proyecto (no importa `ApiError`: se lee
// su forma), para poder probarlo desde server/tests/.
export interface ErroresDeCampo {
  campos: Record<string, string>;
  general: string | null;
}

export function erroresDeCampo(error: unknown): ErroresDeCampo {
  if (!(error instanceof Error)) return { campos: {}, general: "No se pudo guardar" };
  const { status, details } = error as Error & { status?: number; details?: unknown };
  const campos: Record<string, string> = {};
  if (details && typeof details === "object") {
    for (const [campo, mensajes] of Object.entries(details as Record<string, unknown>)) {
      const mensaje = Array.isArray(mensajes) ? mensajes[0] : mensajes;
      if (typeof mensaje === "string") campos[campo] = mensaje;
    }
  }
  if (Object.keys(campos).length > 0) return { campos, general: null };
  if (status === 409 && /DNI/.test(error.message)) return { campos: { dni: error.message }, general: null };
  return { campos, general: error.message };
}

// Un solo mensaje legible para los formularios chicos que no tienen un lugar por campo: los errores de campos juntos, o
// el mensaje del error. Sin error, null.
export function mensajeDeError(error: unknown): string | null {
  if (!error) return null;
  const { campos, general } = erroresDeCampo(error);
  const mensajes = Object.values(campos);
  return mensajes.length > 0 ? mensajes.join(" · ") : general;
}
