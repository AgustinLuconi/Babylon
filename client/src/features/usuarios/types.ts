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

// Una fila de la pestaña "Sin cuenta" (GET /api/auth/sin-cuenta): un responsable o un profesor activo sin cuenta de acceso.
export interface FilaSinCuenta {
  clave: string;
  tipo: "padre" | "profesor";
  fichaId: string;
  nombre: string;
  email: string | null;
}

// Si ese email ya es de una cuenta (GET /api/auth/usuarios/por-email): crear una cuenta le agrega el rol.
export interface CuentaPorEmail {
  id: string;
  nombre: string;
  roles: Rol[];
}

// La ficha de una cuenta con rol padre o profesor: una que ya existe (sin cuenta) o una nueva. El email de la ficha es el de la cuenta.
export type FichaDePadre = { fichaId: string } | { nueva: { nombre: string; apellido: string; telefono: string; dni?: string; direccion?: string } };
export type FichaDeProfesor = { fichaId: string } | { nueva: { nombre: string; apellido: string; dni: string; telefono?: string } };

export interface CrearCuentaInput {
  email: string;
  password?: string;
  nombre?: string;
  roles: Rol[];
  padre?: FichaDePadre;
  profesor?: FichaDeProfesor;
}

export interface ActualizarCuentaInput {
  nombre?: string;
  email?: string;
  password?: string;
  roles?: Rol[];
  padre?: FichaDePadre;
  profesor?: FichaDeProfesor;
}

// `vinculada`: el email ya era de una cuenta y se le agregaron roles (su contraseña no cambió).
export interface CuentaCreada {
  usuario: CuentaUsuario;
  vinculada: boolean;
}
