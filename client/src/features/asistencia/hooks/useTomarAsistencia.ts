import { useMutation } from "@tanstack/react-query";
import { asistenciaService } from "../asistenciaService";

// Todo o nada: RegistrarAsistenciaMasiva está envuelto en UnitOfWork en el
// backend — si un solo alumno de la nómina ya tenía asistencia cargada para
// esa fecha, no se guarda ninguno de los demás.
export function useTomarAsistencia() {
  return useMutation({
    mutationFn: asistenciaService.registrarMasiva,
  });
}
