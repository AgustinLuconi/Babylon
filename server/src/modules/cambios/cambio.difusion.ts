import { alConfirmar } from "../../core/alConfirmar";
import { autorActual } from "../../core/autoria";
import type { TableroDeAnuncios } from "../../core/eventos";
import type { CanalEnVivo } from "../../core/ports";
import type { EventosDelSistema } from "../../eventos";
import type { CambioDeDatos, SenalCambio } from "./cambio.entity";
import type { DestinatariosDeCambios } from "./cambio.destinatarios.prisma";

// Cada `datos.cambiaron` sale, después de confirmar, como señal `cambio` a quienes pueden ver ese dato. Quién lo hizo
// se toma en el momento de publicar (dentro del pedido), no al confirmar.
export function suscribirDifusionDeCambios(
  tablero: TableroDeAnuncios<EventosDelSistema>,
  canal: CanalEnVivo,
  destinatarios: DestinatariosDeCambios,
  buscarNombre: (usuarioId: string) => Promise<string>,
): void {
  tablero.alPublicarse("datos.cambiaron", async (cambio, tx) => {
    const autor = autorActual();
    alConfirmar(tx, () => difundir(cambio, autor));
  });

  async function difundir(cambio: CambioDeDatos, autor: ReturnType<typeof autorActual>): Promise<void> {
    const { roles, cuentas } = await destinatarios.resolver(cambio);
    const datos: SenalCambio = {
      dato: cambio.dato,
      accion: cambio.accion,
      ids: cambio.ids,
      por: autor ? { usuarioId: autor.usuarioId, nombre: await buscarNombre(autor.usuarioId), rol: autor.rol } : null,
    };
    const senal = { tipo: "cambio", datos };
    if (roles.length > 0) canal.enviarARoles(roles, senal);
    // Una cuenta de un rol que ya recibió por rol (una sesión de padre o profesor en `roles`) no se repite.
    for (const c of cuentas) if (!roles.includes(c.rol)) canal.enviarA(c.usuarioId, c.rol, senal);
  }
}
