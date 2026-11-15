import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { cicloService } from "../cicloService";
import type { PaseDeAnioInput } from "../types";

// La vista previa no escribe nada: se vuelve a pedir con cada cambio de las decisiones.
export function useVistaPreviaPaseDeAnio(input: PaseDeAnioInput | null) {
  return useQuery({
    queryKey: ["pase-de-anio", "vista-previa", JSON.stringify(input)],
    queryFn: () => cicloService.vistaPreviaPaseDeAnio(input as PaseDeAnioInput),
    enabled: input !== null,
    placeholderData: keepPreviousData,
    retry: false,
    // Es una consulta con efecto nulo pero sobre datos que cambian: siempre se pide de nuevo.
    staleTime: 0,
  });
}

export function useConfirmarPaseDeAnio() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: PaseDeAnioInput) => cicloService.confirmarPaseDeAnio(input),
    onSuccess: () => {
      for (const clave of ["ciclos", "cursos", "alumnos", "horarios", "cuotas", "inscripciones"]) {
        queryClient.invalidateQueries({ queryKey: [clave] });
      }
    },
  });
}
