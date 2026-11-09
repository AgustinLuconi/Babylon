import { useRef, useState } from "react";
import { Button } from "@/core/components/ui/button";
import { Modal } from "@/core/components/ui/modal";
import { erroresDeCampo } from "@/core/lib/erroresDeCampo";
import { calcularEdad } from "@/core/lib/utils";
import { useSinGuardar } from "@/core/sinGuardar/sinGuardar";
import { useCursos } from "@/features/cursos/hooks/useCursos";
import { SelectorDeResponsable, type SelectorDeResponsableHandle } from "@/features/padres/components/SelectorDeResponsable";
import { useActualizarPadre } from "@/features/padres/hooks/useActualizarPadre";
import { usePadres } from "@/features/padres/hooks/usePadres";
import { useAlumnos } from "../hooks/useAlumnos";
import { useAsignarResponsable } from "../hooks/useAsignarResponsable";
import type { Alumno } from "../types";

// Asignar un responsable a un alumno que no tiene, cambiar al que tiene (o el vínculo) o pasarlo a responsable de sí mismo.
export function CambiarResponsableModal({ alumno, onClose, onGuardado }: { alumno: Alumno; onClose: () => void; onGuardado: (mensaje: string) => void }) {
  const { data: padres } = usePadres();
  const { data: alumnos } = useAlumnos();
  const { data: cursos } = useCursos();
  const asignar = useAsignarResponsable();
  const actualizarPadre = useActualizarPadre();
  const selector = useRef<SelectorDeResponsableHandle>(null);
  const [erroresDelServidor, setErroresDelServidor] = useState<Record<string, string>>({});
  const [general, setGeneral] = useState<string | null>(null);
  const [modificado, setModificado] = useState(false);
  const [guardando, setGuardando] = useState(false);
  useSinGuardar(modificado);

  const curso = cursos?.find((c) => c.id === alumno.cursoId);
  const edad = calcularEdad(alumno.fechaNacimiento);
  const esAdulto = Boolean(curso?.nivel.startsWith("adults_")) || (edad !== null && edad >= 18);

  const guardar = async () => {
    setGeneral(null);
    setErroresDelServidor({});
    const elegido = await selector.current?.validar();
    if (!elegido) return;
    setGuardando(true);
    try {
      if (elegido.completarDni) await actualizarPadre.mutateAsync({ id: elegido.completarDni.padreId, datos: { dni: elegido.completarDni.dni } });
      await asignar.mutateAsync({ id: alumno.id, responsable: elegido.responsable });
      onGuardado(alumno.padreId ? "Responsable actualizado" : "Responsable asignado");
    } catch (error) {
      const { campos, general: mensaje } = erroresDeCampo(error);
      setErroresDelServidor(campos);
      setGeneral(mensaje);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Modal
      title={alumno.padreId ? "Cambiar responsable" : "Asignar responsable"}
      sinGuardar={modificado}
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" className="flex-1" onClick={onClose}>
            Cancelar
          </Button>
          <Button className="flex-1" disabled={guardando} onClick={guardar}>
            {guardando ? "Guardando..." : "Guardar"}
          </Button>
        </>
      }
    >
      <SelectorDeResponsable
        ref={selector}
        padres={padres}
        alumnos={alumnos}
        esAdulto={esAdulto}
        alumno={{ nombre: alumno.nombre, apellido: alumno.apellido, dni: alumno.dni }}
        erroresDelServidor={erroresDelServidor}
        onModificado={setModificado}
      />
      {general && <p className="text-sm text-destructive">{general}</p>}
    </Modal>
  );
}
