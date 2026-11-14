// Descuento por hermanos: se recalcula al inscribir, dar de baja, reactivar y cambiar de responsable; las cuotas ya
// generadas no cambian. Requiere la API levantada en :4000 (mundo prueba-tmp-av).
import { PrismaClient } from "@prisma/client";
import { ok } from "./_check";
import { CLAVE, crearMundo, email, limpiarMundo, P } from "./_mundo-avisos";

const API = "http://localhost:4000";
const prisma = new PrismaClient();

async function login(quien: string): Promise<string> {
  const r = await fetch(`${API}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: email(quien), password: CLAVE }),
  });
  return ((await r.json()) as { token: string }).token;
}
async function pedir<T = Record<string, unknown>>(metodo: string, ruta: string, token: string, cuerpo?: unknown): Promise<{ status: number; d: (T & { error?: string }) | null }> {
  const r = await fetch(`${API}${ruta}`, {
    method: metodo,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
  });
  const texto = await r.text();
  return { status: r.status, d: texto ? JSON.parse(texto) : null };
}

(async () => {
  const m = await crearMundo(prisma);
  const [secre, admin] = await Promise.all([login("secre"), login("admin")]);
  const marca = async (id: string) => (await prisma.alumno.findUniqueOrThrow({ where: { id } })).aplicaDescuentoHermanos;
  const marcaInscripcion = async (id: string) => (await prisma.inscripcion.findFirst({ where: { alumnoId: id, cicloId: m.cicloId } }))?.aplicaDescuentoHermanos;
  const marcas = async (...ids: string[]) => (await Promise.all(ids.map(marca))).join(",");
  const inscribir = async (nombre: string, responsable: object, extra: object = {}, apellido = "Pruebaav") => {
    const r = await pedir<{ id: string; padreId: string }>("POST", "/api/alumnos", secre, { nombre, apellido, cursoId: m.cursoId, responsable, ...extra });
    if (r.status !== 201) throw new Error(`no se pudo inscribir a ${nombre}: ${r.status} ${JSON.stringify(r.d)}`);
    return r.d!;
  };
  const estado = (id: string, e: string) => pedir("PATCH", `/api/alumnos/${id}`, secre, { estado: e });
  const nuevoResp = (apellido: string) => ({ tipo: "nuevo", vinculo: "madre", datos: { nombre: "Pruebaav", apellido, telefono: "351 555-1234" } });
  const avisosDe = (cuenta: string, rol: string, alumnoId: string) =>
    prisma.notificacion.findMany({ where: { usuarioId: cuenta, rol: rol as never, clave: { startsWith: `descuento:${alumnoId}:` } } });

  // ── Inscripción: el primero paga completo, los demás tienen el 10% ──
  const d = await inscribir("Dani", nuevoResp("Resp2")); // el más antiguo de todos
  const a = await inscribir("Ana", nuevoResp("Resp1"));
  const resp1 = a.padreId;
  const resp2 = d.padreId;
  const b = await inscribir("Bruno", { tipo: "existente", padreId: resp1, vinculo: "madre" });
  const c = await inscribir("Carla", { tipo: "existente", padreId: resp1, vinculo: "madre" });
  ok("inscribir: el primero paga completo, los otros dos tienen descuento", await marcas(a.id, b.id, c.id), "false,true,true");
  ok("inscribir: la inscripción del ciclo acompaña a la marca", `${await marcaInscripcion(a.id)},${await marcaInscripcion(b.id)}`, "false,true");
  ok("inscribir: un hermano en otra familia, solo, sin descuento", await marca(d.id), false);

  // Cuotas ya generadas de Bruno (con descuento) y de Carla (vencida): no deben cambiar nunca
  const cuota = (id: string, alumnoId: string, estadoCuota: "pendiente" | "vencida" | "pagada") =>
    prisma.cuota.create({ data: { id: `${P}-cuota-${id}`, alumnoId, mes: 3, anio: 2099, montoBase: 10000, descuento: 1000, montoFinal: 9000, vencimiento: new Date("2099-03-10T00:00:00Z"), estado: estadoCuota } });
  await cuota("b", b.id, "pendiente");
  await cuota("c", c.id, "vencida");
  const fotoCuotas = async () => JSON.stringify(await prisma.cuota.findMany({ where: { id: { startsWith: `${P}-cuota-` } }, orderBy: { id: "asc" } }));
  const cuotasAntes = await fotoCuotas();

  // ── Baja del primero: el siguiente pasa a pagar completo ──
  const baja = await estado(a.id, "inactivo");
  ok("baja: 200", baja.status, 200);
  ok("baja del primero: Bruno paga completo y Carla sigue con descuento", await marcas(b.id, c.id), "false,true");
  ok("baja: quien se fue conserva su marca", await marca(a.id), false);
  ok("baja: la inscripción de Bruno también se corrigió", await marcaInscripcion(b.id), false);
  ok("baja: el aviso le llega a administración", (await avisosDe(m.admin, "admin", b.id)).length, 1);
  ok("baja: y a secretaría", (await avisosDe(m.secre, "secretario", b.id)).length, 1);
  ok("baja: Carla no cambió, no hay aviso", (await avisosDe(m.admin, "admin", c.id)).length, 0);

  // ── Reactivación: Ana vuelve a ser la primera ──
  const alta = await estado(a.id, "activo");
  ok("reactivación: 200", alta.status, 200);
  ok("reactivación: Ana primera, Bruno y Carla con descuento", await marcas(a.id, b.id, c.id), "false,true,true");

  // ── Cambio de responsable: se recalculan las dos familias ──
  const mover = await pedir("PUT", `/api/alumnos/${a.id}/responsable`, secre, { tipo: "existente", padreId: resp2, vinculo: "padre" });
  ok("cambio de responsable: 200", mover.status, 200);
  ok("familia nueva: Dani (más antiguo) paga completo y Ana tiene descuento", await marcas(d.id, a.id), "false,true");
  ok("familia anterior: Bruno pasó a primero, Carla con descuento", await marcas(b.id, c.id), "false,true");
  ok("cambio de responsable: aviso por Ana (la que se movió)", (await avisosDe(m.admin, "admin", a.id)).length >= 1, true);
  ok("cambio de responsable: aviso por Bruno (la familia anterior)", (await avisosDe(m.admin, "admin", b.id)).length >= 1, true);

  // ── Las cuotas ya generadas no cambiaron en nada ──
  ok("las cuotas ya generadas quedaron idénticas", (await fotoCuotas()) === cuotasAntes ? "iguales" : "cambiaron", "iguales");

  // ── Sin fila de inscripción en el ciclo activo no falla ──
  await prisma.inscripcion.deleteMany({ where: { alumnoId: c.id } });
  const sinFila = await estado(b.id, "inactivo");
  ok("sin inscripción del ciclo: la baja no falla", sinFila.status, 200);
  ok("sin inscripción del ciclo: Carla pasa a pagar completo", await marca(c.id), false);
  ok("sin inscripción del ciclo: no se crea la fila", await prisma.inscripcion.count({ where: { alumnoId: c.id } }), 0);

  // ── Familia con aviso al responsable con cuenta (padre del mundo) ──
  await prisma.alumno.update({ where: { id: m.hijo2 }, data: { aplicaDescuentoHermanos: true } }); // como si ya lo tuviera
  await estado(m.hijo1, "inactivo");
  ok("responsable con cuenta: pasa a pagar completo", await marca(m.hijo2), false);
  const delPadre = await avisosDe(m.padre, "padre", m.hijo2);
  ok("responsable con cuenta: recibe el aviso", delPadre.length, 1);
  ok("el aviso aclara desde cuándo rige", delPadre[0]?.texto.endsWith("Rige desde la próxima cuota que se genere."), true);
  await estado(m.hijo1, "activo");
  ok("reactivación en la familia del mundo: hijo1 primero, hijo2 con descuento", await marcas(m.hijo1, m.hijo2), "false,true");

  // ── Adulto responsable de sí mismo ──
  const propio = await inscribir("Pruebaav", { tipo: "propio", telefono: "351 555-9999" }, { dni: "99400031", fechaNacimiento: "1990-01-01" }, "Propio");
  ok("adulto propio solo: sin descuento", await marca(propio.id), false);
  const hijoDelPropio = await inscribir("HijoPropio", { tipo: "existente", padreId: propio.padreId, vinculo: "madre" });
  ok("adulto propio con un hijo suyo: el hijo (más nuevo) tiene descuento", await marcas(propio.id, hijoDelPropio.id), "false,true");

  // ── Dos bajas a la vez en una familia de tres ──
  const e = await inscribir("Eva", nuevoResp("Resp4"));
  const f = await inscribir("Fede", { tipo: "existente", padreId: e.padreId, vinculo: "madre" });
  const g = await inscribir("Gina", { tipo: "existente", padreId: e.padreId, vinculo: "madre" });
  const [r1, r2] = await Promise.all([estado(e.id, "inactivo"), estado(f.id, "inactivo")]);
  ok("dos bajas simultáneas: ninguna falla", `${r1.status} ${r2.status}`, "200 200");
  ok("dos bajas simultáneas: queda Gina sola, sin descuento", await marca(g.id), false);

  // ── Un administrador puede hacer lo mismo (el permiso es el de siempre) ──
  const comoAdmin = await pedir("PATCH", `/api/alumnos/${e.id}`, admin, { estado: "activo" });
  ok("administrador reactiva: 200", comoAdmin.status, 200);
  ok("Eva vuelve y es la primera; Gina pasa a tener descuento", await marcas(e.id, g.id), "false,true");

  // ── Dos cambios de responsable a la vez sobre el mismo alumno: uno gana, el otro recibe 409 o se aplica después; nunca 500 ──
  const h = await inscribir("Hugo", nuevoResp("Resp5"));
  const r6 = await inscribir("Irma", nuevoResp("Resp6"));
  const r7 = await inscribir("Juan", nuevoResp("Resp7"));
  const [m1, m2] = await Promise.all([
    pedir("PUT", `/api/alumnos/${h.id}/responsable`, secre, { tipo: "existente", padreId: r6.padreId, vinculo: "padre" }),
    pedir("PUT", `/api/alumnos/${h.id}/responsable`, secre, { tipo: "existente", padreId: r7.padreId, vinculo: "padre" }),
  ]);
  ok("dos cambios de responsable simultáneos: ninguno da 500", [m1.status, m2.status].every((x) => x === 200 || x === 409), true);
  ok("dos cambios de responsable simultáneos: al menos uno se aplicó", [m1.status, m2.status].includes(200), true);
  const final = await prisma.alumno.findUniqueOrThrow({ where: { id: h.id } });
  ok("el alumno quedó con uno de los dos responsables", [r6.padreId, r7.padreId].includes(final.padreId as string), true);
  const enFamilia = (padreId: string) => prisma.alumno.findMany({ where: { padreId, estado: "activo" }, orderBy: { fechaInscripcion: "asc" } });
  const destino = await enFamilia(final.padreId as string);
  ok("la familia que lo recibió queda con exactamente uno que paga completo", destino.filter((a) => !a.aplicaDescuentoHermanos).length, 1);

  await limpiarMundo(prisma);
  ok("limpieza", await prisma.alumno.count({ where: { OR: [{ id: { startsWith: P } }, { apellido: "Pruebaav" }] } }), 0);
  await prisma.$disconnect();
})().catch(async (err) => {
  ok("sin excepciones", String(err), "ninguna");
  await limpiarMundo(prisma).catch(() => {});
  await prisma.$disconnect();
  process.exit(1);
});
