export type Rol = "admin" | "secretario" | "profesor" | "padre";

export const ROL_LABELS: Record<Rol, string> = {
  admin: "Administrador",
  secretario: "Secretario",
  profesor: "Profesor",
  padre: "Padre/Madre/Tutor",
};

export interface Usuario {
  id: string;
  nombre: string;
  email: string;
  rol: Rol;
}

export interface SesionAutenticada {
  requiereSeleccionRol: false;
  token: string;
  usuario: Usuario;
}

export interface SeleccionRolRequerida {
  requiereSeleccionRol: true;
  rolesDisponibles: Rol[];
}

// Una cuenta puede tener más de un rol habilitado (ej. dueño del instituto
// que también dicta clases); el login devuelve esto y el usuario elige con
// cuál entra para esa sesión — ver LoginPage.
export type ResultadoAutenticacion = SesionAutenticada | SeleccionRolRequerida;

export interface CredencialesInput {
  email: string;
  password: string;
  rolElegido?: Rol;
}
