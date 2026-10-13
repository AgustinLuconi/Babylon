import { apiClient } from "@/core/lib/apiClient";
import type { CrearAdministradorInput, CuentaCreada, CuentaUsuario, EstadoCuenta, FilaPendiente, InvitarInput, ResultadoEnvio } from "./types";

export const usuarioService = {
  listar: () => apiClient.get<CuentaUsuario[]>("/api/auth/usuarios"),
  cambiarEstado: (id: string, estado: EstadoCuenta) =>
    apiClient.patch<CuentaUsuario>(`/api/auth/usuarios/${id}/estado`, { estado }),
  crearAdministrador: (datos: CrearAdministradorInput) =>
    apiClient.post<CuentaCreada>("/api/auth/administradores", datos),
  pendientes: () => apiClient.get<FilaPendiente[]>("/api/auth/pendientes"),
  invitar: (datos: InvitarInput) =>
    apiClient.post<{ resultados: ResultadoEnvio[] }>("/api/auth/invitaciones", datos).then((r) => r.resultados),
  reenviar: (usuarioIds: string[]) =>
    apiClient.post<{ resultados: ResultadoEnvio[] }>("/api/auth/invitaciones/reenviar", { usuarioIds }).then((r) => r.resultados),
  cancelarInvitacion: (usuarioId: string) => apiClient.delete<void>(`/api/auth/invitaciones/${usuarioId}`),
};
