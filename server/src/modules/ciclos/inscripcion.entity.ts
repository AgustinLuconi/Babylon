// Entidad secundaria de `ciclos`: historial de en qué curso estuvo cada
// alumno en cada ciclo lectivo — a diferencia de `Alumno.cursoId` (el curso
// ACTUAL), esto no se sobreescribe al pasar de ciclo, así no se pierde en
// qué curso estuvo el alumno en años anteriores.
export interface Inscripcion {
  id: string;
  alumnoId: string;
  cursoId: string;
  cicloId: string;
  fecha: Date;
  aplicaDescuentoHermanos: boolean;
}
