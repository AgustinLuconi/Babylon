// Editar una cuenta (solo el administrador): email, nombre, contraseña y roles, el emparejamiento del email con la ficha en los
// dos sentidos, el cierre de sesiones y las reglas de roles. Requiere la API en :4000 (mundo prueba-tmp-av).
import { PrismaClient } from "@prisma/client";
import { ok } from "./_check";
import { CLAVE, crearMundo, email, limpiarMundo, P } from "./_mundo-avisos";

const API = "http://localhost:4000";
const prisma = new PrismaClient();
async function acceso(correo: string, password: string, rolElegido?: string) {
  const r = await fetch(`${API}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: correo, password, ...(rolElegido ? { rolElegido } : {}) }) });
  const d = (await r.json().catch(() => null)) as { token?: string; requiereSeleccionRol?: boolean; rolesDisponibles?: string[] } | null;
  return { status: r.status, token: d?.token ?? null, d };
}
const entrar = async (quien: string, password = CLAVE, rol?: string) => (await acceso(email(quien), password, rol)).token as string;
async function pedir(metodo: string, ruta: string, token: string | null, cuerpo?: unknown) {
  const r = await fetch(`${API}${ruta}`, {
    method: metodo,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: cuerpo === undefined || metodo === "GET" ? undefined : JSON.stringify(cuerpo),
  });
  const texto = await r.text();
  return { status: r.status, d: texto.startsWith("{") || texto.startsWith("[") ? (JSON.parse(texto) as any) : null };
}
const sesionViva = async (token: string) => (await pedir("GET", "/api/auth/yo", token)).status;

(async () => {
  const m = await crearMundo(prisma);
  const admin = await entrar("admin");
  const secre = await entrar("secre");
  const editar = (id: string, cuerpo: object, token = admin) => pedir("PATCH", `/api/auth/usuarios/${id}`, token, cuerpo);
  const usuario = (id: string) => prisma.usuario.findUniqueOrThrow({ where: { id } });
  const padreD = () => prisma.padre.findUniqueOrThrow({ where: { id: m.padreId } });
  const profeD = () => prisma.profesor.findUniqueOrThrow({ where: { id: m.profesorId } });

  // ── Email: cuenta → ficha ──
  const nuevoEmail = email("padre-nuevo");
  ok("cambiar el email de la cuenta de un responsable", (await editar(m.padre, { email: nuevoEmail })).status, 200);
  ok("la ficha toma el email nuevo", (await padreD()).email, nuevoEmail);
  ok("entra con el email nuevo y no con el viejo", `${(await acceso(nuevoEmail, CLAVE)).status} ${(await acceso(email("padre"), CLAVE)).status}`, "200 401");
  const antes = (await usuario(m.padre)).email;
  ok("un email que ya usa otra cuenta: 409", (await editar(m.padre, { email: email("secre") })).status, 409);
  ok("y no cambió nada", `${(await usuario(m.padre)).email === antes} ${(await padreD()).email}`, `true ${nuevoEmail}`);
  ok("un email inválido: 400", (await editar(m.padre, { email: "xx" })).status, 400);
  ok("cambiar el email no cierra la sesión de esa persona", await sesionViva(await entrar("ajeno")), 200);

  // ── Email: ficha → cuenta ──
  ok("cambiar el email de la ficha del responsable (por su pantalla)", (await pedir("PATCH", `/api/padres/${m.padreId}`, secre, { email: email("padre-ficha") })).status, 200);
  ok("la cuenta toma el email de la ficha", (await usuario(m.padre)).email, email("padre-ficha"));
  ok("un email que usa otra cuenta desde la ficha: 409", (await pedir("PATCH", `/api/padres/${m.padreId}`, secre, { email: email("secre") })).status, 409);
  ok("y ni la ficha ni la cuenta cambiaron", `${(await padreD()).email} ${(await usuario(m.padre)).email}`, `${email("padre-ficha")} ${email("padre-ficha")}`);
  ok("cambiar el email de la ficha del profesor", (await pedir("PATCH", `/api/profesores/${m.profesorId}`, admin, { email: email("profe-ficha") })).status, 200);
  ok("la cuenta del profesor toma el email de la ficha", (await usuario(m.profe)).email, email("profe-ficha"));
  ok("un email ya usado desde la ficha del profesor: 409", (await pedir("PATCH", `/api/profesores/${m.profesorId}`, admin, { email: email("secre") })).status, 409);
  ok("y ninguna de las dos cambió", `${(await profeD()).email} ${(await usuario(m.profe)).email}`, `${email("profe-ficha")} ${email("profe-ficha")}`);

  // ── Nombre ──
  ok("el nombre de una cuenta con ficha se cambia desde la ficha: 400", (await editar(m.padre, { nombre: "Otro Nombre" })).status, 400);
  ok("el nombre de una cuenta de secretario se edita", `${(await editar(m.secre, { nombre: "Pruebaav Renombrada" })).status} ${(await usuario(m.secre)).nombre}`, "200 Pruebaav Renombrada");

  // ── Contraseña ──
  const ajenoViejo = await entrar("ajeno");
  ok("contraseña de 7 caracteres: 400", (await editar(m.ajeno, { password: "abcdefg" })).status, 400);
  ok("contraseña de 73 bytes: 400", (await editar(m.ajeno, { password: "ñ".repeat(37) })).status, 400);
  ok("contraseña de 8 espacios: 400", (await editar(m.ajeno, { password: "        " })).status, 400);
  ok("sin contraseña no se cierran sesiones", `${(await editar(m.ajeno, { email: email("ajeno-otro") })).status} ${await sesionViva(ajenoViejo)}`, "200 200");
  const hashAntes = (await usuario(m.ajeno)).passwordHash;
  ok("cambiar la contraseña", (await editar(m.ajeno, { password: "clavenueva99" })).status, 200);
  ok("la sesión abierta de esa persona se cierra", await sesionViva(ajenoViejo), 401);
  ok("entra con la nueva y no con la vieja", `${(await acceso(email("ajeno-otro"), "clavenueva99")).status} ${(await acceso(email("ajeno-otro"), CLAVE)).status}`, "200 401");
  ok("el hash cambió", (await usuario(m.ajeno)).passwordHash !== hashAntes, true);

  // El administrador se edita a sí mismo: conserva la sesión desde la que lo hace y se cierran las demás.
  const adminOtra = await entrar("admin");
  ok("el administrador cambia su propia contraseña", (await editar(m.admin, { password: "adminnueva1" })).status, 200);
  ok("su sesión actual sigue abierta", await sesionViva(admin), 200);
  ok("sus otras sesiones se cerraron", await sesionViva(adminOtra), 401);

  // ── Roles ──
  ok("agregar secretario al propio administrador", (await editar(m.admin, { roles: ["admin", "secretario"] })).status, 200);
  const dosRoles = await acceso(email("admin"), "adminnueva1");
  ok("con dos roles el ingreso pide elegir", `${dosRoles.d?.requiereSeleccionRol} ${dosRoles.d?.rolesDisponibles?.slice().sort().join()}`, "true admin,secretario");
  ok("administrador sin su propio rol de administrador: 400", (await editar(m.admin, { roles: ["secretario"] })).status, 400);
  ok("una cuenta sin roles: 400", (await editar(m.secre, { roles: [] })).status, 400);
  ok("roles repetidos: 400", (await editar(m.secre, { roles: ["secretario", "secretario"] })).status, 400);

  // Agregar el rol de profesor: se vincula una ficha sin cuenta.
  const pf = await prisma.profesor.create({ data: { id: `${P}-pf9`, nombre: "Pruebaav", apellido: "Pf9", dni: "99400301", estado: "activo" } });
  const secreViejo = await entrar("secre");
  ok("agregar profesor sin ficha: 400", (await editar(m.secre, { roles: ["secretario", "profesor"] })).status, 400);
  ok("una ficha de profesor sin agregar el rol: 400", (await editar(m.secre, { roles: ["secretario"], profesor: { fichaId: pf.id } })).status, 400);
  ok("agregar profesor con una ficha sin cuenta", (await editar(m.secre, { roles: ["secretario", "profesor"], profesor: { fichaId: pf.id } })).status, 200);
  ok("la cuenta suma el rol", (await usuario(m.secre)).roles.slice().sort().join(), "profesor,secretario");
  const pfD = await prisma.profesor.findUniqueOrThrow({ where: { id: pf.id } });
  ok("la ficha queda vinculada y con el email de la cuenta", `${pfD.usuarioId === m.secre} ${pfD.email}`, `true ${(await usuario(m.secre)).email}`);
  ok("cambiar los roles cierra las sesiones de esa cuenta", await sesionViva(secreViejo), 401);
  ok("una ficha que ya tiene cuenta: 409", (await editar(m.ajeno, { roles: ["padre", "profesor"], profesor: { fichaId: m.profesorId } })).status, 409);

  // Quitar el rol de profesor: se desvincula la ficha, que conserva sus cursos.
  ok("quitar profesor a una cuenta con cursos", (await editar(m.multi, { roles: ["admin"] })).status, 200);
  const multiFicha = await prisma.profesor.findUniqueOrThrow({ where: { id: m.profesorMultiId } });
  ok("la ficha queda sin cuenta", multiFicha.usuarioId, null);
  ok("y el curso sigue siendo del profesor", (await prisma.curso.findUniqueOrThrow({ where: { id: m.cursoMultiId } })).profesorId, m.profesorMultiId);
  ok("la cuenta quedó solo con admin", (await usuario(m.multi)).roles.join(), "admin");
  const sinCuenta = await pedir("GET", "/api/auth/sin-cuenta", admin);
  ok("la ficha vuelve a la lista Sin cuenta", (sinCuenta.d ?? []).some((f: { clave: string }) => f.clave === `profesor:${m.profesorMultiId}`), true);

  // Agregar un responsable con una ficha nueva.
  ok("agregar padre con ficha nueva", (await editar(m.multi, { roles: ["admin", "padre"], padre: { nueva: { nombre: "Pruebaav", apellido: "Mixta", telefono: "351 555-1234" } } })).status, 200);
  ok("la ficha nueva queda vinculada", await prisma.padre.count({ where: { usuarioId: m.multi } }), 1);

  // ── Atomicidad ──
  const rolesAntes = (await usuario(m.ajeno)).roles.slice().sort().join();
  const hashAjeno = (await usuario(m.ajeno)).passwordHash;
  ok("contraseña + roles + email con un email repetido: 409", (await editar(m.ajeno, { password: "otraclave123", roles: ["padre", "secretario"], email: email("secre") })).status, 409);
  const despues = await usuario(m.ajeno);
  ok("no cambió ni la contraseña ni los roles ni el email", `${despues.passwordHash === hashAjeno} ${despues.roles.slice().sort().join() === rolesAntes} ${despues.email}`, `true true ${email("ajeno-otro")}`);

  // ── Permisos y formas ──
  ok("un campo desconocido: 400", (await editar(m.ajeno, { estado: "inactivo" })).status, 400);
  ok("la secretaria no entra", (await editar(m.ajeno, { nombre: "x" }, await entrar("secre", CLAVE, "secretario"))).status, 403);
  ok("sin sesión", (await pedir("PATCH", `/api/auth/usuarios/${m.ajeno}`, null, { nombre: "x" })).status, 401);
  ok("una cuenta que no existe: 404", (await editar("no-existe", { nombre: "x" })).status, 404);

  await limpiarMundo(prisma);
  await prisma.$disconnect();
})();
