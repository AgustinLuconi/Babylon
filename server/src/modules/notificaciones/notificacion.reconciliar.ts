import type { AvisoEsperado, Destinatario, Notificacion, RecursoAviso } from "./notificacion.entity";

export interface CambiosDeAvisos {
  crear: Notificacion[];
  actualizar: { id: string; datos: Partial<Notificacion> }[];
  // Abiertos que ya no corresponden: se resuelven todos juntos (una sola sentencia).
  resolver: string[];
  // Cuentas (con su rol) cuya campana cambió: reciben una señal en tiempo real.
  afectados: Destinatario[];
}

const llave = (x: { usuarioId: string; rol: string; clave: string }) => `${x.usuarioId}|${x.rol}|${x.clave}`;
// El recurso vuelve de la base (jsonb) con las claves en otro orden: se compara ordenado.
const canonico = (r: RecursoAviso) =>
  JSON.stringify(Object.entries(r).sort(([a], [b]) => a.localeCompare(b)));

// Reglas de vida de los avisos de estado (puras: no leen ni escriben nada):
// - lo esperado que no existe se crea, sin leer;
// - lo que existe se actualiza solo si cambió algo; si estaba resuelto se reabre, y si el nivel sube (la cuota pasa a
//   vencida, el número del agrupado crece) vuelve a "no leído";
// - lo abierto que ya no se espera se resuelve.
export function reconciliar(
  existentes: Notificacion[],
  esperados: AvisoEsperado[],
  ahora: Date,
  nuevoId: () => string,
): CambiosDeAvisos {
  const crear: Notificacion[] = [];
  const actualizar: CambiosDeAvisos["actualizar"] = [];
  const resolver: string[] = [];
  const afectados = new Map<string, Destinatario>();
  const afectar = ({ usuarioId, rol }: Destinatario) => afectados.set(`${usuarioId}|${rol}`, { usuarioId, rol });
  const porLlave = new Map(existentes.map((n) => [llave(n), n]));
  const esperadas = new Set(esperados.map(llave));

  for (const e of esperados) {
    const n = porLlave.get(llave(e));
    if (!n) {
      crear.push({ ...e, id: nuevoId(), clase: "estado", creadaEn: ahora, actualizadaEn: ahora, leidaEn: null, resueltaEn: null });
      afectar(e);
      continue;
    }
    const reabre = n.resueltaEn !== null;
    const cambio =
      reabre || n.texto !== e.texto || n.tono !== e.tono || n.nivel !== e.nivel || canonico(n.recurso) !== canonico(e.recurso);
    if (!cambio) continue;
    const datos: Partial<Notificacion> = { texto: e.texto, tono: e.tono, nivel: e.nivel, recurso: e.recurso, actualizadaEn: ahora };
    if (reabre || e.nivel > n.nivel) Object.assign(datos, { leidaEn: null, resueltaEn: null });
    actualizar.push({ id: n.id, datos });
    afectar(n);
  }
  for (const n of existentes) {
    if (n.resueltaEn === null && !esperadas.has(llave(n))) {
      resolver.push(n.id);
      afectar(n);
    }
  }
  return { crear, actualizar, resolver, afectados: [...afectados.values()] };
}
