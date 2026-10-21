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
  // Toda sesión cerrada (por cualquier camino) cambia la lista de sesiones de Mi cuenta de esa cuenta.
  tablero.alPublicarse("sesiones.cerradas", async ({ usuarioId }, tx) => {
    const autor = autorActual();
    alConfirmar(tx, () => difundir({ dato: "sesiones", accion: "cierre", ids: { usuarioIds: [usuarioId] } }, autor));
  });

  async function difundir(cambio: CambioDeDatos, autor: ReturnType<typeof autorActual>): Promise<void> {
    const { roles, cuentas } = await destinatarios.resolver(cambio);
    const datos: SenalCambio = {
      dato: cambio.dato,
      accion: cambio.accion,
      ids: cambio.ids,
      por: autor ? { usuarioId: autor.usuarioId, nombre: await buscarNombre(autor.usuarioId), rol: autor.rol } : null,
    };
    if (roles.length > 0) canal.enviarARoles(roles, { tipo: "cambio", datos });
    // Cada familia y cada profesor, con sus ids recortados. Un rol que ya recibió por rol no se repite.
    for (const c of cuentas) {
      if (!roles.includes(c.rol)) canal.enviarA(c.usuarioId, c.rol, { tipo: "cambio", datos: { ...datos, ids: c.ids } });
    }
  }
}
