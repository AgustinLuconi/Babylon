import { useState } from "react";
import { Button } from "@/core/components/ui/button";
import { Input } from "@/core/components/ui/input";
import { Modal } from "@/core/components/ui/modal";
import { ApiError } from "@/core/lib/apiClient";
import { formatFecha } from "@/core/lib/utils";
import { useMarcarSinClases } from "../hooks/useMarcarSinClases";

// Marcar una clase del curso como "sin clases" (un imprevisto). El motivo es opcional y solo lo ve el equipo del instituto.
export function ModalSinClases({ cursoId, fecha, onClose }: { cursoId: string; fecha: string; onClose: () => void }) {
  const marcar = useMarcarSinClases();
  const [motivo, setMotivo] = useState("");

  const onMarcar = () => {
    marcar.mutate({ cursoId, fecha, motivo: motivo.trim() || undefined }, { onSuccess: onClose });
  };

  return (
    <Modal
      title="Marcar sin clases"
      onClose={onClose}
      sinGuardar={motivo.trim() !== ""}
      footer={
        <>
          <Button variant="outline" className="flex-1" onClick={onClose}>
            Cancelar
          </Button>
          <Button className="flex-1" disabled={marcar.isPending} onClick={onMarcar}>
            {marcar.isPending ? "Guardando…" : "Marcar sin clases"}
          </Button>
        </>
      }
    >
      <p className="text-[13px] text-muted-foreground">
        La clase del <strong className="text-foreground">{formatFecha(fecha)}</strong> no se dio. No cuenta como falta ni como asistencia para nadie, y queda
        registrada como "Sin clases". Las familias la ven como "Sin clases", sin el motivo.
      </p>
      <div className="space-y-1.5">
        <label className="label" htmlFor="motivo-sin-clases">
          Motivo <span className="font-normal text-muted-foreground">· opcional</span>
        </label>
        <Input id="motivo-sin-clases" value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={200} placeholder="Ej: corte de luz" autoFocus />
      </div>
      {marcar.isError && <p className="text-sm text-destructive">{marcar.error instanceof ApiError ? marcar.error.message : "No se pudo marcar la clase"}</p>}
    </Modal>
  );
}
