import { apiClient } from "@/core/lib/apiClient";
import type { AutorizarImagenInput, Documento, MarcarCargadoInput } from "./types";

export const documentoService = {
  listarPorAlumno: (alumnoId: string) => apiClient.get<Documento[]>(`/api/documentos/alumnos/${alumnoId}`),
  marcarCargado: (alumnoId: string, datos: MarcarCargadoInput) =>
    apiClient.patch<Documento>(`/api/documentos/alumnos/${alumnoId}/cargar`, datos),
  obtenerAutorizacionImagen: (alumnoId: string) =>
    apiClient.get<Documento | null>(`/api/documentos/alumnos/${alumnoId}/autorizacion-imagen`),
  autorizarImagen: (datos: AutorizarImagenInput) => apiClient.post<Documento>("/api/documentos/autorizacion-imagen", datos),
  marcarAutorizacionManual: (alumnoId: string) =>
    apiClient.patch<Documento>(`/api/documentos/alumnos/${alumnoId}/autorizacion-imagen/manual`),
  revocarAutorizacion: (alumnoId: string) =>
    apiClient.patch<Documento>(`/api/documentos/alumnos/${alumnoId}/autorizacion-imagen/revocar`),
};
