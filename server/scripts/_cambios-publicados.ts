// Cada escritura de la API anuncia qué dato cambió (y quién lo hizo), y la señal llega por la conexión en vivo.
// Requiere la API levantada. Usa el mundo de prueba (prefijo prueba-tmp-av) y limpia lo que crea por la API.
import { PrismaClient } from "@prisma/client";
import { ok } from "./_check";
import { CLAVE, crearMundo, email, limpiarMundo, P } from "./_mundo-avisos";

const API = "http://localhost:4000";
const prisma = new PrismaClient();
const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function login(quien: string, rolElegido?: string): Promise<string> {
  const r = await fetch(`${API}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: email(quien), password: CLAVE, ...(rolElegido ? { rolElegido } : {}) }),
  });
  return ((await r.json()) as { token: string }).token;
}
async function pedir<T = unknown>(metodo: string, ruta: string, token: string, cuerpo?: unknown): Promise<{ status: number; d: T }> {
  const r = await fetch(`${API}${ruta}`, {
    method: metodo,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
  });
  const texto = await r.text();
  return { status: r.status, d: (texto ? JSON.parse(texto) : null) as T };
}
interface Cambio {
  dato: string;
  accion: string;
  ids: Record<string, string[]>;
  por: { usuarioId: string; nombre: string; rol: string } | null;
}
// Junta las señales `cambio` de una conexión en vivo.
function escuchar(token: string) {
  const cambios: Cambio[] = [];
  const control = new AbortController();
  let resto = "";
  void fetch(`${API}/api/tiempo-real`, { headers: { Authorization: `Bearer ${token}` }, signal: control.signal })
    .then(async (res) => {
      const dec = new TextDecoder();
      for await (const trozo of res.body!) {
        resto += dec.decode(trozo, { stream: true });
        let i;
        while ((i = resto.indexOf("\n\n")) >= 0) {
          const bloque = resto.slice(0, i);
          resto = resto.slice(i + 2);
          if (bloque.startsWith("event: cambio\n")) cambios.push(JSON.parse(bloque.split("data: ")[1]));
        }
      }
    })
    .catch(() => {});
  return { cambios, cortar: () => control.abort() };
}
const corto = (id: string) => id.replace(`${P}-`, "");
const resumen = (c: Cambio | undefined) =>
  c ? `${c.dato}/${c.accion} ${Object.entries(c.ids).map(([k, v]) => `${k}=${v.map(corto).sort().join("+")}`).sort().join(" ")}` : "ninguno";

// Lo que esta prueba crea por la API tiene ids al azar: se reconoce por el nombre, el DNI o el año.
async function limpiarCreados(): Promise<void> {
  await prisma.ciclo.deleteMany({ where: { anio: 2099 } });
  const cursos = await prisma.curso.findMany({ where: { nombre: "Pruebaav Nuevo" }, select: { id: true } });
  await prisma.horario.deleteMany({ where: { cursoId: { in: cursos.map((c) => c.id) } } });
  await prisma.curso.deleteMany({ where: { id: { in: cursos.map((c) => c.id) } } });
  await prisma.padre.deleteMany({ where: { dni: "99400092" } });
  await prisma.profesor.deleteMany({ where: { dni: "99400093" } });
  await prisma.configuracion.updateMany({ data: { valorCuota: null } });
}

(async () => {
  await limpiarCreados();
  const m = await crearMundo(prisma);
  const [admin, secre, profe, padre] = [await login("admin"), await login("secre"), await login("profe"), await login("padre")];
  const enAdmin = escuchar(admin);
  const enPadre = escuchar(padre);
  await esperar(600);
  // Corre una escritura y devuelve los cambios nuevos que vio el admin (y cuántos vio el padre).
  async function tras<T>(fn: () => Promise<T>): Promise<{ r: T; nuevos: Cambio[]; alPadre: Cambio[] }> {
    const [a, p] = [enAdmin.cambios.length, enPadre.cambios.length];
    const r = await fn();
    await esperar(500);
    return { r, nuevos: enAdmin.cambios.slice(a), alPadre: enPadre.cambios.slice(p) };
  }
  const del = (x: { nuevos: Cambio[] }, dato: string) => x.nuevos.find((c) => c.dato === dato);

  // Alumnos
  const insc = await tras(() =>
    pedir<{ id: string }>("POST", "/api/alumnos", secre, { nombre: "Nuevoav", apellido: "Pruebaav", dni: "99400091", fechaNacimiento: "2015-05-05", responsable: { tipo: "existente", padreId: m.padreId, vinculo: "madre" }, cursoId: m.cursoId }),
  );
  const nuevo = insc.r.d.id;
  ok("inscribir", resumen(del(insc, "alumnos")), `alumnos/inscripcion alumnoIds=${nuevo} cursoIds=curso`);
  ok("con quién lo hizo", JSON.stringify(del(insc, "alumnos")?.por), JSON.stringify({ usuarioId: m.secre, nombre: "Pruebaav secre", rol: "secretario" }));
  ok("al padre le llega", insc.alPadre.some((c) => c.dato === "alumnos") ? "sí" : "no", "sí");
  ok("editar datos", resumen(del(await tras(() => pedir("PATCH", `/api/alumnos/${nuevo}`, secre, { telefono: "351 555-1234" })), "alumnos")), `alumnos/edicion alumnoIds=${nuevo} cursoIds=curso`);
  ok("cambiar de curso", resumen(del(await tras(() => pedir("PATCH", `/api/alumnos/${nuevo}`, secre, { cursoId: m.cursoMultiId })), "alumnos")), `alumnos/cambio-curso alumnoIds=${nuevo} cursoIds=curso+curso-multi`);
  ok("dar de baja", resumen(del(await tras(() => pedir("PATCH", `/api/alumnos/${nuevo}`, secre, { estado: "inactivo" })), "alumnos")), `alumnos/baja alumnoIds=${nuevo} cursoIds=curso-multi`);
  ok("reactivar", resumen(del(await tras(() => pedir("PATCH", `/api/alumnos/${nuevo}`, secre, { estado: "activo" })), "alumnos")), `alumnos/reactivacion alumnoIds=${nuevo} cursoIds=curso-multi`);

  // Cursos
  const cursoNuevo = await tras(() => pedir<{ id: string }>("POST", "/api/cursos", admin, { nombre: "Pruebaav Nuevo", nivel: "kids", profesorId: m.profesorId, cupo: 10 }));
  ok("crear curso", resumen(del(cursoNuevo, "cursos")), `cursos/alta cursoIds=${cursoNuevo.r.d.id} profesorIds=profe`);
  ok("reasignar curso", resumen(del(await tras(() => pedir("PATCH", `/api/cursos/${cursoNuevo.r.d.id}`, admin, { profesorId: m.profesorMultiId })), "cursos")), `cursos/edicion cursoIds=${cursoNuevo.r.d.id} profesorIds=multi+profe`);

  // Cuotas
  await prisma.cuota.create({ data: { id: `${P}-cuota-a`, alumnoId: m.hijo1, mes: 10, anio: 2026, montoBase: 1000, descuento: 0, montoFinal: 1000, vencimiento: new Date("2026-10-10T00:00:00Z"), estado: "pendiente" } });
  const cobro = await tras(() => pedir("POST", "/api/cuotas/pagos", secre, { cuotaIds: [`${P}-cuota-a`], metodo: "efectivo" }));
  ok("cobrar", resumen(del(cobro, "cuotas")), "cuotas/cobro alumnoIds=hijo1 cuotaIds=cuota-a");
  ok("un cobro fallido (ya pagada) no anuncia", (await tras(() => pedir("POST", "/api/cuotas/pagos", secre, { cuotaIds: [`${P}-cuota-a`], metodo: "efectivo" }))).nuevos.length, 0);

  // Evaluaciones, notas y notas de cierre (lo que es borrador nunca le llega al padre)
  const ev = await tras(() => pedir<{ id: string }>("POST", "/api/calificaciones/evaluaciones", profe, { cursoId: m.cursoId, nombre: "Writing", tipo: "examen", fecha: "2026-10-20", periodo: "noviembre" }));
  const evId = ev.r.d.id;
  ok("crear evaluación", resumen(del(ev, "evaluaciones")), `evaluaciones/alta cursoIds=curso evaluacionIds=${evId}`);
  ok("al padre no le llega la evaluación borrador", ev.alPadre.length, 0);
  const notasBorrador = await tras(() => pedir("POST", `/api/calificaciones/evaluaciones/${evId}/calificaciones`, profe, { notas: [{ alumnoId: m.hijo1, nota: "8" }] }));
  ok("cargar notas en borrador", resumen(del(notasBorrador, "calificaciones")), `calificaciones/carga alumnoIds=hijo1 cursoIds=curso evaluacionIds=${evId}`);
  ok("al padre no le llegan notas en borrador", notasBorrador.alPadre.length, 0);
  const pub = await tras(() => pedir("PATCH", `/api/calificaciones/evaluaciones/${evId}/publicar`, profe));
  ok("publicar evaluación", resumen(del(pub, "evaluaciones")), `evaluaciones/publicacion cursoIds=curso evaluacionIds=${evId}`);
  ok("al padre sí le llega la publicación", pub.alPadre.length, 1);
  ok("notas sobre una evaluación publicada le llegan al padre", (await tras(() => pedir("POST", `/api/calificaciones/evaluaciones/${evId}/calificaciones`, profe, { notas: [{ alumnoId: m.hijo1, nota: "9" }] }))).alPadre.length, 1);
  const cierre = await tras(() => pedir<{ id: string }[]>("POST", "/api/calificaciones/notas-cierre", profe, { notas: [{ alumnoId: m.hijo1, cursoId: m.cursoId, periodo: "noviembre", nota: "8" }] }));
  ok("cargar notas de cierre", resumen(del(cierre, "notas-cierre")), "notas-cierre/carga alumnoIds=hijo1 cursoIds=curso");
  ok("al padre no le llegan notas de cierre en borrador", cierre.alPadre.length, 0);
  const cierrePub = await tras(() => pedir("POST", "/api/calificaciones/notas-cierre/publicar", profe, { ids: cierre.r.d.map((n) => n.id) }));
  ok("publicar notas de cierre", resumen(del(cierrePub, "notas-cierre")), "notas-cierre/publicacion alumnoIds=hijo1 cursoIds=curso");
  ok("al padre le llega la publicación del cierre", cierrePub.alPadre.length, 1);

  // Asistencia, observaciones, categorías y documentos
  ok("tomar asistencia", resumen(del(await tras(() => pedir("POST", "/api/asistencia/masiva", profe, { cursoId: m.cursoId, fecha: "2026-10-20", registros: [{ alumnoId: m.hijo1, estado: "presente" }] })), "asistencia")), "asistencia/registro alumnoIds=hijo1 cursoIds=curso");
  const obs = await tras(() => pedir<{ id: string }>("POST", "/api/observaciones", secre, { alumnoId: m.hijo1, texto: "Buen trabajo", categoria: "academico" }));
  ok("escribir una observación", resumen(del(obs, "observaciones")), `observaciones/alta alumnoIds=hijo1 observacionIds=${obs.r.d.id}`);
  ok("crear una categoría propia", resumen(del(await tras(() => pedir("POST", "/api/observaciones/categorias", profe, { cursoId: m.cursoId, nombre: "Lectura" })), "categorias")), "categorias/alta cursoIds=curso");
  ok("cargar un documento", resumen(del(await tras(() => pedir("PATCH", `/api/documentos/alumnos/${m.hijo1}/cargar`, secre, { tipo: "copia_dni" })), "documentos")), "documentos/carga alumnoIds=hijo1");
  ok("autorizar la imagen (padre)", resumen(del(await tras(() => pedir("POST", "/api/documentos/autorizacion-imagen", padre, { alumnoId: m.hijo1 })), "documentos")), "documentos/autorizacion alumnoIds=hijo1");
  ok("revocar la autorización", resumen(del(await tras(() => pedir("PATCH", `/api/documentos/alumnos/${m.hijo1}/autorizacion-imagen/revocar`, secre)), "documentos")), "documentos/revocacion alumnoIds=hijo1");
  ok("autorización manual", resumen(del(await tras(() => pedir("PATCH", `/api/documentos/alumnos/${m.hijo1}/autorizacion-imagen/manual`, secre)), "documentos")), "documentos/manual alumnoIds=hijo1");

  // Padres, profesores, usuarios, configuración y ciclos
  const padreNuevo = await tras(() => pedir<{ padre: { id: string } }>("POST", "/api/padres", secre, { nombre: "Pruebaav", apellido: "Padrenuevo", dni: "99400092", telefono: "351 555-1234", email: email("padrenuevo"), password: "prueba1234" }));
  const padreNuevoId = padreNuevo.r.d.padre?.id ?? (padreNuevo.r.d as unknown as { id: string }).id;
  ok("alta de padre", resumen(del(padreNuevo, "padres")), `padres/alta padreIds=${padreNuevoId}`);
  ok("edición de padre", resumen(del(await tras(() => pedir("PATCH", `/api/padres/${padreNuevoId}`, secre, { telefono: "351 555-1234" })), "padres")), `padres/edicion padreIds=${padreNuevoId}`);
  const profNuevo = await tras(() => pedir<{ profesor: { id: string } }>("POST", "/api/profesores", admin, { nombre: "Pruebaav", apellido: "Profenuevo", dni: "99400093", email: email("profenuevo"), password: "prueba1234" }));
  const profNuevoId = profNuevo.r.d.profesor?.id ?? (profNuevo.r.d as unknown as { id: string }).id;
  ok("alta de profesor", resumen(del(profNuevo, "profesores")), `profesores/alta profesorIds=${profNuevoId}`);
  ok("edición de profesor", resumen(del(await tras(() => pedir("PATCH", `/api/profesores/${profNuevoId}`, admin, { telefono: "351 555-1234" })), "profesores")), `profesores/edicion profesorIds=${profNuevoId}`);
  const secreNueva = await tras(() => pedir<{ id: string }>("POST", "/api/auth/secretarios", admin, { nombre: "Pruebaav Secrenueva", email: email("secrenueva"), password: "prueba1234" }));
  ok("alta de secretaria", resumen(del(secreNueva, "usuarios")), `usuarios/alta usuarioIds=${secreNueva.r.d.id}`);
  ok("cambio de estado de una cuenta", resumen(del(await tras(() => pedir("PATCH", `/api/auth/usuarios/${secreNueva.r.d.id}/estado`, admin, { estado: "inactivo" })), "usuarios")), `usuarios/estado usuarioIds=${secreNueva.r.d.id}`);
  await prisma.padre.create({ data: { id: `${P}-invitado`, nombre: "Pruebaav", apellido: "Invitado", dni: "99400094", email: email("invitado") } });
  const inv = await tras(() => pedir<{ resultados: { usuarioId?: string }[] }>("POST", "/api/auth/invitaciones", admin, { padreIds: [`${P}-invitado`] }));
  ok("invitar", del(inv, "usuarios")?.accion, "invitacion");
  const invitadoId = (await prisma.padre.findUnique({ where: { id: `${P}-invitado` } }))?.usuarioId as string;
  ok("cancelar la invitación", resumen(del(await tras(() => pedir("DELETE", `/api/auth/invitaciones/${invitadoId}`, admin)), "usuarios")), `usuarios/invitacion usuarioIds=${invitadoId}`);
  ok("a la familia no le llega nada de cuentas", inv.alPadre.length, 0);
  ok("configuración", resumen(del(await tras(() => pedir("PATCH", "/api/configuracion", admin, { valorCuota: 1234 })), "configuracion")), "configuracion/edicion ");
  // El valor vuelve a estar vacío enseguida: con un valor cargado, la tarea automática generaría cuotas de prueba.
  await prisma.configuracion.updateMany({ data: { valorCuota: null } });
  const ciclo = await tras(() => pedir<{ id: string }>("POST", "/api/ciclos", admin, { anio: 2099 }));
  ok("alta de ciclo", resumen(del(ciclo, "ciclos")), `ciclos/alta cicloIds=${ciclo.r.d.id}`);
  ok("el alta de un ciclo no les llega a las familias (no pueden leer ciclos)", ciclo.alPadre.some((c) => c.dato === "ciclos") ? "sí" : "no", "no");

  // Sesiones: iniciar sesión de nuevo con la misma cuenta actualiza la lista de sesiones de esa cuenta
  ok("iniciar sesión", del(await tras(() => login("admin")), "sesiones")?.accion, "inicio");

  // Limpieza de lo creado por la API (ids al azar)
  enAdmin.cortar();
  enPadre.cortar();
  await limpiarCreados();
  await limpiarMundo(prisma);
  ok("limpieza", await prisma.usuario.count({ where: { email: { startsWith: P } } }), 0);
  await prisma.$disconnect();
  process.exit(0);
})();
