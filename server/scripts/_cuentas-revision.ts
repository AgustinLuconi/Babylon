// Hallazgos de la revisión final de las cuentas: una cuenta inactiva no se reactiva sola al editar la ficha del profesor, el nombre
// de la ficha del responsable llega a la cuenta, el email se empareja con todas las fichas de la cuenta, desactivar la ficha de un
// profesor no deja afuera a una cuenta con más roles, y quitar un rol borra los avisos de ese rol (privacidad entre familias).
// Requiere la API en :4000 (mundo prueba-tmp-av).
import { PrismaClient } from "@prisma/client";
import { ok } from "./_check";
import { CLAVE, crearMundo, email, limpiarMundo, P } from "./_mundo-avisos";

const API = "http://localhost:4000";
const prisma = new PrismaClient();
async function entrar(quien: string): Promise<string> {
  const r = await fetch(`${API}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: email(quien), password: CLAVE }) });
  return ((await r.json()) as { token: string }).token;
}
async function pedir(metodo: string, ruta: string, token: string, cuerpo?: unknown) {
  const r = await fetch(`${API}${ruta}`, { method: metodo, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo) });
  const texto = await r.text();
  return { status: r.status, d: texto ? JSON.parse(texto) : null };
}

(async () => {
  const m = await crearMundo(prisma);
  const admin = await entrar("admin");
  const usuario = (id: string) => prisma.usuario.findUniqueOrThrow({ where: { id } });
  const editar = (id: string, cuerpo: object) => pedir("PATCH", `/api/auth/usuarios/${id}`, admin, cuerpo);

  // 1) Una cuenta inactiva no se reactiva al editar la ficha del profesor que se le vinculó.
  const pfA = await prisma.profesor.create({ data: { id: `${P}-pfa`, nombre: "Pruebaav", apellido: "Pfa", dni: "99400401", estado: "activo" } });
  await pedir("PATCH", `/api/auth/usuarios/${m.ajeno}/estado`, admin, { estado: "inactivo" });
  ok("vincular un profesor activo a una cuenta inactiva", (await editar(m.ajeno, { roles: ["padre", "profesor"], profesor: { fichaId: pfA.id } })).status, 200);
  ok("editar el teléfono del profesor", (await pedir("PATCH", `/api/profesores/${pfA.id}`, admin, { telefono: "351 555-9999" })).status, 200);
  ok("la cuenta inactiva sigue inactiva", (await usuario(m.ajeno)).estado, "inactivo");

  // 2) El nombre de la ficha del responsable llega a su cuenta.
  ok("cambiar el nombre de la ficha del responsable", (await pedir("PATCH", `/api/padres/${m.padreId}`, admin, { nombre: "Pruebaav2" })).status, 200);
  ok("la cuenta toma el nombre de la ficha", (await usuario(m.padre)).nombre, "Pruebaav2 padre");

  // 3) Una cuenta con las dos fichas: el email se empareja con las dos; desactivar al profesor no deja afuera a una cuenta con más roles.
  const fa = await prisma.padre.create({ data: { id: `${P}-fa`, nombre: "Pruebaav", apellido: "Fa", dni: "99400402", telefono: "+5493515551234" } });
  const pfB = await prisma.profesor.create({ data: { id: `${P}-pfb`, nombre: "Pruebaav", apellido: "Pfb", dni: "99400403", estado: "activo" } });
  ok("una cuenta con las dos fichas", (await editar(m.secre, { roles: ["secretario", "padre", "profesor"], padre: { fichaId: fa.id }, profesor: { fichaId: pfB.id } })).status, 200);
  ok("cambiar el email desde la ficha del responsable", (await pedir("PATCH", `/api/padres/${fa.id}`, admin, { email: email("dual-nuevo") })).status, 200);
  const fichas = `${(await usuario(m.secre)).email} ${(await prisma.padre.findUniqueOrThrow({ where: { id: fa.id } })).email} ${(await prisma.profesor.findUniqueOrThrow({ where: { id: pfB.id } })).email}`;
  ok("el email quedó igual en la cuenta y en las dos fichas", fichas, `${email("dual-nuevo")} ${email("dual-nuevo")} ${email("dual-nuevo")}`);
  ok("desactivar la ficha del profesor de una cuenta con más roles", (await pedir("PATCH", `/api/profesores/${m.profesorMultiId}`, admin, { estado: "inactivo" })).status, 200);
  ok("la cuenta con rol de administrador sigue activa", (await usuario(m.multi)).estado, "activo");
  ok("desactivar la ficha de un profesor que solo es profesor", (await pedir("PATCH", `/api/profesores/${m.profesorId}`, admin, { estado: "inactivo" })).status, 200);
  ok("su cuenta sí se desactiva", (await usuario(m.profe)).estado, "inactivo");

  // 4) Quitar un rol borra los avisos de ese rol y deja los de los otros.
  await editar(m.padre, { roles: ["padre", "secretario"] });
  const ahora = new Date();
  const aviso = (rol: "padre" | "secretario", clave: string) =>
    prisma.notificacion.create({ data: { id: `${P}-n-${rol}`, usuarioId: m.padre, rol, tipo: "nota_publicada", clase: "evento", clave, tono: "info", texto: "Nueva nota de un alumno", recurso: {}, nivel: 0, creadaEn: ahora, actualizadaEn: ahora } });
  await aviso("padre", "nota:e1:a1");
  await aviso("secretario", "nota:e1:a2");
  ok("antes: la cuenta tiene un aviso de cada rol", await prisma.notificacion.count({ where: { usuarioId: m.padre, tipo: "nota_publicada" } }), 2);
  ok("quitar el rol de responsable", (await editar(m.padre, { roles: ["secretario"] })).status, 200);
  ok("los avisos del rol quitado se borran", await prisma.notificacion.count({ where: { usuarioId: m.padre, rol: "padre", clase: "evento" } }), 0);
  ok("los del otro rol quedan", await prisma.notificacion.count({ where: { usuarioId: m.padre, rol: "secretario", clase: "evento" } }), 1);

  await limpiarMundo(prisma);
  await prisma.$disconnect();
})();
