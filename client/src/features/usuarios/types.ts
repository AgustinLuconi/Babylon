import type { Rol } from "@/features/auth/types";

export type EstadoCuenta = "activo" | "inactivo";

// Cuenta de acceso (Usuario) — la API nunca expone el hash de la contraseña.
export interface CuentaUsuario {
  id: string;
  nombre: string;
  email: string;
  roles: Rol[];
  estado: EstadoCuenta;
  fechaCreacion: string;
}

export interface CrearAdministradorInput {
  nombre: string;
  email: string;
  password: string;
}
