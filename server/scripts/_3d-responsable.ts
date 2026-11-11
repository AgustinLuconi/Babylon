// 3d, Tarea 5: responsable del alumno (inscripción atómica, alumno "propio", ficha existente, asignar o cambiar el
// responsable y sincronización de nombre/apellido/DNI). Requiere la API levantada en :4000 (mundo prueba-tmp-av).
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
interface Respuesta<T = Record<string, unknown>> {
  status: number;
  d: (T & { error?: string; details?: Record<string, string[]> }) | null;
}
async function pedir<T = Record<string, unknown>>(metodo: string, ruta: string, token: string, cuerpo?: unknown): Promise<Respuesta<T>> {
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
  const [secre, ajeno] = await Promise.all([login("secre"), login("ajeno")]);
  const alumno = (id: string) => prisma.alumno.findUniqueOrThrow({ where: { id } });
  const padre = (id: string) => prisma.padre.findUniqueOrThrow({ where: { id } });
  const inscribir = (cuerpo: object) => pedir<{ id: string; padreId: string; invitacion: string | null }>("POST", "/api/alumnos", secre, { cursoId: m.cursoId, ...cuerpo });
  const nuevo = (apellido: string, extra: object = {}, vinculo = "madre") => ({
    tipo: "nuevo",
    vinculo,
    datos: { nombre: "Pruebaav", apellido, telefono: "351 555-1234", ...extra },
  });
  const fichasPrueba = () => prisma.padre.count({ where: { nombre: "Pruebaav" } });

  // ── Menor con responsable nuevo, lo mínimo ──
  const r1 = await inscribir({ nombre: "Pruebaav", apellido: "Menor1", responsable: nuevo("Resp1") });
  ok("menor mínimo: se inscribe", r1.status, 201);
  const a1 = await alumno(r1.d!.id);
  const p1 = await padre(a1.padreId!);
  ok("menor mínimo: vínculo en el alumno", a1.vinculoResponsable, "madre");
  ok("menor mínimo: sin DNI ni fecha de nacimiento", `${a1.dni} ${a1.fechaNacimiento}`, "null null");
  ok("menor mínimo: ficha con celular normalizado, sin DNI, email ni cuenta", `${p1.telefono} ${p1.dni} ${p1.email} ${p1.usuarioId}`, "+5493515551234 null null null");
  ok("menor mínimo: sin cuenta no hay invitación", r1.d!.invitacion, null);

  // ── Con email: cuenta pendiente e invitación; con contraseña: cuenta activa ──
  const r2 = await inscribir({ nombre: "Pruebaav", apellido: "Menor2", responsable: nuevo("Resp2", { email: email("resp2") }, "padre") });
  const p2 = await padre((await alumno(r2.d!.id)).padreId!);
  const u2 = await prisma.usuario.findUniqueOrThrow({ where: { id: p2.usuarioId! } });
  ok("con email: cuenta pendiente", `${r2.status} ${u2.estado}`, "201 pendiente");
  ok("con email: sale la invitación", r2.d!.invitacion, "enviada");
  const r2b = await inscribir({ nombre: "Pruebaav", apellido: "Menor2b", responsable: nuevo("Resp2b", { email: email("resp2b"), password: "prueba1234" }) });
  const u2b = await prisma.usuario.findUniqueOrThrow({ where: { id: (await padre((await alumno(r2b.d!.id)).padreId!)).usuarioId! } });
  ok("con contraseña: cuenta activa y sin invitación", `${u2b.estado} ${r2b.d!.invitacion}`, "activo null");

  // ── Atomicidad: un curso que no existe no deja ninguna ficha ──
  const antes = await fichasPrueba();
  const falla = await inscribir({ nombre: "Pruebaav", apellido: "Falla", cursoId: "no-existe", responsable: nuevo("Resp3", { dni: "99400111" }) });
  const reintento = await inscribir({ nombre: "Pruebaav", apellido: "Falla", cursoId: "no-existe", responsable: nuevo("Resp3", { dni: "99400111" }) });
  ok("curso inexistente: se rechaza", `${falla.status} ${reintento.status}`, "404 404");
  ok("curso inexistente: no queda ninguna ficha, ni con el reintento", (await fichasPrueba()) - antes, 0);
  ok("falta el responsable", (await inscribir({ nombre: "Pruebaav", apellido: "SinResp" })).status, 400);

  // ── Dos responsables nuevos sin DNI no chocan entre sí ──
  const sd1 = await inscribir({ nombre: "Pruebaav", apellido: "SinDni1", responsable: nuevo("Sindni1") });
  const sd2 = await inscribir({ nombre: "Pruebaav", apellido: "SinDni2", responsable: nuevo("Sindni2") });
  ok("dos responsables sin DNI", `${sd1.status} ${sd2.status}`, "201 201");

  // ── Adulto responsable de sí mismo ──
  const r4 = await inscribir({
    nombre: "Pruebaav",
    apellido: "Adulto1",
    dni: "99400112",
    fechaNacimiento: "1990-05-05",
    responsable: { tipo: "propio", telefono: "0351 15 555 1234", email: email("adulto1") },
  });
  const a4 = await alumno(r4.d!.id);
  const p4 = await padre(a4.padreId!);
  ok("adulto propio: se inscribe con vínculo propio", `${r4.status} ${a4.vinculoResponsable}`, "201 propio");
  ok("adulto propio: la ficha tiene sus mismos datos", `${p4.nombre} ${p4.apellido} ${p4.dni} ${p4.telefono}`, "Pruebaav Adulto1 99400112 +5493515551234");
  ok("adulto propio: cuenta pendiente con invitación", `${(await prisma.usuario.findUniqueOrThrow({ where: { id: p4.usuarioId! } })).estado} ${r4.d!.invitacion}`, "pendiente enviada");
  const diezAnios = `${new Date().getFullYear() - 10}-01-01`;
  const menorPropio = await inscribir({ nombre: "Pruebaav", apellido: "Chico", dni: "99400114", fechaNacimiento: diezAnios, responsable: { tipo: "propio", telefono: "351 555-1234" } });
  ok("propio con menos de 18 años", `${menorPropio.status} ${menorPropio.d?.details && "fechaNacimiento" in menorPropio.d.details}`, "400 true");

  // ── Propio sobre una ficha que ya existe (la mamá): la ficha manda ──
  await prisma.padre.update({ where: { id: m.padreAjenoId }, data: { telefono: "+5491155550000", email: null } });
  const r5 = await inscribir({
    nombre: "Otro",
    apellido: "Nombre",
    dni: "99400002",
    fechaNacimiento: "1985-02-02",
    responsable: { tipo: "propio", telefono: "351 555-1234", email: email("mama") },
  });
  const a5 = await alumno(r5.d!.id);
  const mama = await padre(m.padreAjenoId);
  ok("propio con DNI existente: reutiliza la ficha", `${r5.status} ${a5.padreId === m.padreAjenoId}`, "201 true");
  ok("la ficha manda: el alumno toma su nombre", `${a5.nombre} ${a5.apellido}`, `Pruebaav ajeno`);
  ok("la ficha manda: no pisa su celular", mama.telefono, "+5491155550000");
  ok("la ficha manda: completa el email que le faltaba", mama.email, email("mama"));
  // El DNI de un alumno es único, así que dos alumnos no pueden compartir el de la ficha; el caso solo se da con un alumno
  // "propio" al que se le borró el DNI (dato viejo o cargado a mano): ahí la ficha ya tiene su alumno propio.
  await prisma.alumno.update({ where: { id: a5.id }, data: { dni: null } });
  const segundo = await inscribir({ nombre: "Pruebaav", apellido: "Doble", dni: "99400002", fechaNacimiento: "1985-02-02", responsable: { tipo: "propio", telefono: "351 555-1234" } });
  ok("una ficha tiene un solo alumno propio", segundo.status, 409);
  ok("el conflicto no dejó un alumno nuevo", await prisma.alumno.count({ where: { dni: "99400002" } }), 0);
  await prisma.alumno.update({ where: { id: a5.id }, data: { dni: "99400002" } });

  // ── La mamá ve sus dos cursadas, con el vínculo ──
  const mios = await pedir<unknown[]>("GET", "/api/alumnos/mios", ajeno);
  const vinculos = (mios.d as unknown as { vinculoResponsable?: string }[]).map((a) => a.vinculoResponsable ?? "-").sort().join(",");
  ok("GET /mios: sus dos cursadas, una propia", `${(mios.d as unknown as unknown[]).length} ${vinculos}`, "2 -,propio");

  // ── Sincronización de nombre, apellido y DNI entre el alumno propio y su ficha ──
  await pedir("PATCH", `/api/alumnos/${a4.id}`, secre, { nombre: "Renombrado" });
  ok("propio: cambiar el nombre del alumno cambia el de la ficha", (await padre(p4.id)).nombre, "Renombrado");
  await pedir("PATCH", `/api/padres/${p4.id}`, secre, { apellido: "Reapellidado" });
  ok("propio: cambiar el apellido de la ficha cambia el del alumno", (await alumno(a4.id)).apellido, "Reapellidado");
  await pedir("PATCH", `/api/alumnos/${a4.id}`, secre, { dni: "99400115" });
  ok("propio: cambiar el DNI del alumno cambia el de la ficha", (await padre(p4.id)).dni, "99400115");
  await pedir("PATCH", `/api/padres/${m.padreAjenoId}`, secre, { nombre: "Mamá" });
  ok("la mamá: la ficha cambia el nombre de su alumno propio", (await alumno(a5.id)).nombre, "Mamá");
  ok("la mamá: el otro hijo de la ficha no cambia", (await alumno(m.alumnoAjeno)).nombre, "Ajenoav");
  const dniChoca = await pedir("PATCH", `/api/alumnos/${a4.id}`, secre, { dni: "99400001" });
  ok("propio: un DNI que ya es de otra ficha es 409", dniChoca.status, 409);
  ok("propio: tras el 409 nada cambió", `${(await alumno(a4.id)).dni} ${(await padre(p4.id)).dni}`, "99400115 99400115");

  // ── Asignar o cambiar el responsable de un alumno ya inscripto ──
  await prisma.alumno.create({ data: { id: `${P}-sinresp`, nombre: "Pruebaav", apellido: "Sinresp", dni: "99400120", fechaNacimiento: new Date("1990-01-01T00:00:00Z"), fechaInscripcion: new Date(), estado: "activo", cursoId: m.cursoId, aplicaDescuentoHermanos: false } });
  const asignar = (cuerpo: object) => pedir("PUT", `/api/alumnos/${P}-sinresp/responsable`, secre, cuerpo);
  const as1 = await asignar({ tipo: "existente", padreId: m.padreId, vinculo: "tutor" });
  ok("asignar responsable existente", `${as1.status} ${(await alumno(`${P}-sinresp`)).padreId === m.padreId} ${(await alumno(`${P}-sinresp`)).vinculoResponsable}`, "200 true tutor");
  await asignar({ tipo: "existente", padreId: m.padreId, vinculo: "madre" });
  ok("cambiar el vínculo", (await alumno(`${P}-sinresp`)).vinculoResponsable, "madre");
  const as3 = await asignar({ tipo: "propio", telefono: "351 555-1234" });
  const sr = await alumno(`${P}-sinresp`);
  ok("pasar a propio crea su ficha con sus datos", `${as3.status} ${sr.vinculoResponsable} ${(await padre(sr.padreId!)).dni}`, "200 propio 99400120");
  const fichaPropia = sr.padreId!;
  await asignar({ tipo: "existente", padreId: m.padreId, vinculo: "padre" });
  await pedir("PATCH", `/api/alumnos/${P}-sinresp`, secre, { nombre: "Cambiado" });
  ok("dejar de ser propio corta la sincronización", `${(await alumno(`${P}-sinresp`)).vinculoResponsable} ${(await padre(fichaPropia)).nombre}`, "padre Pruebaav");
  ok("asignar a un alumno que no existe", (await pedir("PUT", "/api/alumnos/no-existe/responsable", secre, { tipo: "existente", padreId: m.padreId, vinculo: "padre" })).status, 404);

  // ── Alta de un responsable desde Usuarios: sin vínculo ni alumno ──
  const rp = await pedir<{ id: string; usuarioId: string | null; invitacion: string | null }>("POST", "/api/padres", secre, { nombre: "Pruebaav", apellido: "Suelto1", telefono: "351 555-1234" });
  ok("POST /padres mínimo: ficha sin cuenta", `${rp.status} ${rp.d?.usuarioId ?? null} ${rp.d?.invitacion}`, "201 null null");
  const rpe = await pedir<{ id: string; usuarioId: string | null; invitacion: string | null }>("POST", "/api/padres", secre, { nombre: "Pruebaav", apellido: "Suelto2", telefono: "351 555-1234", email: email("suelto2") });
  ok("POST /padres con email: cuenta pendiente e invitación", `${rpe.status} ${rpe.d?.usuarioId !== null} ${rpe.d?.invitacion}`, "201 true enviada");
  ok("POST /padres sin teléfono", (await pedir("POST", "/api/padres", secre, { nombre: "Pruebaav", apellido: "Suelto3" })).status, 400);
  ok("POST /padres con contraseña y sin email", (await pedir("POST", "/api/padres", secre, { nombre: "Pruebaav", apellido: "Suelto4", telefono: "351 555-1234", password: "prueba1234" })).status, 400);

  await limpiarMundo(prisma);
  await prisma.$disconnect();
})();
