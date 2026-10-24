import { useEffect, useState } from "react";

// Si el curso que el profesor tenía abierto deja de estar a su cargo (el administrador se lo asignó a otro o lo
// desactivó), devuelve su id: la pantalla se queda en ese curso (con lo tipeado) y avisa, en vez de saltar sola a
// otro. Elegir otro curso a propósito lo descarta.
export function useCursoPerdido(cursoPedido: string | null, candidato: string | undefined, cursos: { id: string }[] | undefined): string | null {
  const [ultimo, setUltimo] = useState<string | null>(null);
  const existe = (id: string | null | undefined) => !!id && !!cursos?.some((c) => c.id === id);
  const perdido = cursos !== undefined && ultimo !== null && !existe(ultimo) && (cursoPedido === null || cursoPedido === ultimo) ? ultimo : null;

  useEffect(() => {
    if (!perdido && candidato && existe(candidato) && candidato !== ultimo) setUltimo(candidato);
  }, [candidato, perdido, cursos]); // eslint-disable-line react-hooks/exhaustive-deps

  return perdido;
}
