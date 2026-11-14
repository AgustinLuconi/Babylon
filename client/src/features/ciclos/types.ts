export interface Ciclo {
  id: string;
  anio: number;
  activo: boolean;
  // Un ciclo bloqueado no admite cambios de lo que le pertenece (cursos, asistencia, notas…).
  bloqueado: boolean;
}

export interface CrearCicloInput {
  anio: number;
}
