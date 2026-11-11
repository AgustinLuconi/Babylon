import type { AvisoEsperado, Notificacion } from "../src/modules/notificaciones/notificacion.entity";
import { reconciliar, type CambiosDeAvisos } from "../src/modules/notificaciones/notificacion.reconciliar";
import { ok } from "./_check";

const AHORA = new Date("2026-10-15T15:00:00Z");
const ANTES = new Date("2026-10-10T15:00:00Z");
let n = 0;
const id = () => `nuevo${++n}`;
const esperado = (clave: string, extra: Partial<AvisoEsperado> = {}): AvisoEsperado => ({
  usuarioId: "u1",
  rol: "padre",
  tipo: "cuota",
  clave,
  tono: "warning",
  texto: `texto ${clave}`,
  recurso: { tipo: "cuota", alumnoId: "a1", cuotaId: clave },
  nivel: 1,
  ...extra,
});
const fila = (clave: string, extra: Partial<Notificacion> = {}): Notificacion => ({
  ...esperado(clave),
  id: `f-${clave}`,
  clase: "estado",
  creadaEn: ANTES,
  actualizadaEn: ANTES,
  leidaEn: ANTES,
  resueltaEn: null,
  ...extra,
});
const r = (existentes: Notificacion[], esperados: AvisoEsperado[]) => reconciliar(existentes, esperados, AHORA, id);
const cambio = (res: CambiosDeAvisos, idFila: string) => res.actualizar.find((a) => a.id === idFila)?.datos ?? {};
const tocaLeida = (datos: Partial<Notificacion>) => ("leidaEn" in datos ? "toca leidaEn" : "no toca");

let x = r([], [esperado("c1")]);
ok("1: crea el aviso nuevo", x.crear.length, 1);
ok("1: nace sin leer", x.crear[0].leidaEn, null);
ok("1: es de estado", x.crear[0].clase, "estado");
ok("1: un afectado", x.afectados.length, 1);

// El recurso guardado vuelve de la base con otro orden de claves (jsonb): no cuenta como cambio.
x = r([fila("c1", { recurso: { cuotaId: "c1", alumnoId: "a1", tipo: "cuota" } })], [esperado("c1")]);
ok("2: igual no crea", x.crear.length, 0);
ok("2: igual no actualiza", x.actualizar.length, 0);
ok("2: igual no afecta a nadie", x.afectados.length, 0);

x = r([fila("c1")], [esperado("c1", { texto: "otro" })]);
ok("3: actualiza el texto", cambio(x, "f-c1").texto, "otro");
ok("3: sigue leído", tocaLeida(cambio(x, "f-c1")), "no toca");
ok("3: cambia la fecha", cambio(x, "f-c1").actualizadaEn?.toISOString(), AHORA.toISOString());

x = r([fila("c1")], [esperado("c1", { nivel: 2, tono: "danger" })]);
ok("4: el nivel sube y vuelve a no leído", cambio(x, "f-c1").leidaEn, null);
ok("4: cambia el tono", cambio(x, "f-c1").tono, "danger");

x = r([fila("c1", { nivel: 5 })], [esperado("c1", { nivel: 3 })]);
ok("5: el nivel baja y sigue leído", tocaLeida(cambio(x, "f-c1")), "no toca");
ok("5: guarda el nivel nuevo", cambio(x, "f-c1").nivel, 3);

x = r([fila("c1", { resueltaEn: ANTES })], [esperado("c1")]);
ok("6: reabre", cambio(x, "f-c1").resueltaEn, null);
ok("6: reabierto queda sin leer", cambio(x, "f-c1").leidaEn, null);
ok("6: no crea otra fila", x.crear.length, 0);

x = r([fila("c1")], []);
ok("7: resuelve lo que ya no se espera (en la lista de resolver, no en actualizar)", `${x.resolver.join()} ${x.actualizar.length}`, "f-c1 0");
ok("7: afecta a su cuenta", x.afectados.length, 1);

x = r([fila("c1", { resueltaEn: ANTES })], []);
ok("8: lo ya resuelto no se toca", x.actualizar.length + x.resolver.length, 0);

x = r([fila("c1")], [esperado("c1"), esperado("c1", { usuarioId: "u2" }), esperado("c1", { rol: "admin" })]);
ok("9: misma clave en otra cuenta u otro rol es otro aviso", x.crear.length, 2);

x = r([fila("c1"), fila("c2")], [esperado("c3")]);
ok("10: un afectado por cuenta y rol", x.afectados.length, 1);
