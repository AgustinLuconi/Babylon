import { apiClient } from "@/core/lib/apiClient";
import type { CrearAdministradorInput, CuentaUsuario, EstadoCuenta } from "./types";

export const usuarioService = {
  listar: () => apiClient.get<CuentaUsuario[]>("/api/auth/usuarios"),
  cambiarEstado: (id: string, estado: EstadoCuenta) =>
    apiClient.patch<CuentaUsuario>(`/api/auth/usuarios/${id}/estado`, { estado }),
  crearAdministrador: (datos: CrearAdministradorInput) =>
    apiClient.post<CuentaUsuario>("/api/auth/administradores", datos),
};
