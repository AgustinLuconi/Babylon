import { apiClient } from "@/core/lib/apiClient";
import type {
  ActualizarCuentaInput,
  CrearCuentaInput,
  CuentaCreada,
  CuentaPorEmail,
  CuentaUsuario,
  EstadoCuenta,
  FilaSinCuenta,
} from "./types";

export const usuarioService = {
  listar: () => apiClient.get<CuentaUsuario[]>("/api/auth/usuarios"),
  cambiarEstado: (id: string, estado: EstadoCuenta) => apiClient.patch<CuentaUsuario>(`/api/auth/usuarios/${id}/estado`, { estado }),
  sinCuenta: () => apiClient.get<FilaSinCuenta[]>("/api/auth/sin-cuenta"),
  porEmail: (email: string) => apiClient.get<CuentaPorEmail | null>(`/api/auth/usuarios/por-email?${new URLSearchParams({ email })}`),
  crearCuenta: (datos: CrearCuentaInput) => apiClient.post<CuentaCreada>("/api/auth/cuentas", datos),
  actualizarCuenta: (id: string, datos: ActualizarCuentaInput) => apiClient.patch<CuentaUsuario>(`/api/auth/usuarios/${id}`, datos),
};
