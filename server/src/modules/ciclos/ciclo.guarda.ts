import { ConflictError, EntityNotFoundError } from "../../core/errors";
import type { CursoRepository } from "../cursos/curso.repository";
import type { CicloRepository } from "./ciclo.repository";

// La única función de entrada del bloqueo de ciclos: cada escritura de algo que pertenece a un ciclo la llama dentro de
// su transacción, antes de escribir. Nunca mira el ciclo activo: mira el ciclo de lo que se va a escribir.
export interface VerificadorDeCiclo {
  verificarCicloAbierto(cicloId: string, tx?: unknown): Promise<void>;
  // Para lo que pertenece a un curso (horarios, asistencia, evaluaciones, notas, categorías): resuelve su ciclo.
  verificarCicloDelCurso(cursoId: string, tx?: unknown): Promise<void>;
}

export function crearVerificadorDeCiclo(cicloRepo: CicloRepository, cursoRepo: CursoRepository): VerificadorDeCiclo {
  const verificarCicloAbierto = async (cicloId: string, tx?: unknown): Promise<void> => {
    // Lectura con bloqueo compartido: un bloqueo simultáneo del ciclo espera a que esta transacción termine.
    const ciclo = await cicloRepo.bloquearParaLectura(cicloId, tx);
    if (!ciclo) throw new EntityNotFoundError("Ciclo", cicloId);
    if (ciclo.bloqueado) throw new ConflictError(`El ciclo ${ciclo.anio} está bloqueado. Pedile al administrador que lo desbloquee.`);
  };
  return {
    verificarCicloAbierto,
    verificarCicloDelCurso: async (cursoId, tx) => {
      const curso = await cursoRepo.findById(cursoId, tx);
      if (!curso) throw new EntityNotFoundError("Curso", cursoId);
      await verificarCicloAbierto(curso.cicloId, tx);
    },
  };
}

// Valor por defecto de los services construidos sin guarda (scripts de prueba viejos): no verifica nada. container.ts
// siempre pasa la real; la prueba de la batería recorre todas las rutas para detectar un olvido.
export function cicloSiempreAbierto(): VerificadorDeCiclo {
  return { verificarCicloAbierto: async () => {}, verificarCicloDelCurso: async () => {} };
}
