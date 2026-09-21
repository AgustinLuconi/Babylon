export type EstadoProfesor = "activo" | "inactivo";

export interface Profesor {
  id: string;
  nombre: string;
  // Un profesor importado de datos históricos puede tener estos 3 campos
  // vacíos todavía (sin cuenta de acceso hasta conseguir el dato real).
  apellido?: string;
  dni?: string;
  telefono?: string;
  email?: string;
  usuarioId?: string;
  estado: EstadoProfesor;
}

export interface CrearProfesorInput {
  nombre: string;
  apellido: string;
  dni: string;
  telefono?: string;
  email: string;
  password: string;
}

export interface ActualizarProfesorInput {
  nombre?: string;
  apellido?: string;
  dni?: string;
  telefono?: string;
  email?: string;
  estado?: EstadoProfesor;
}
