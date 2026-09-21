export interface Secretario {
  id: string;
  nombre: string;
  email: string;
  estado: "activo" | "inactivo";
  fechaCreacion: string;
}

export interface CrearSecretarioInput {
  nombre: string;
  email: string;
  password: string;
}
