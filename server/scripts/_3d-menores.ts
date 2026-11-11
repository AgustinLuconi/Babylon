// 3d, pendientes menores: DNI repetido en pedidos simultáneos (409, no 500), doble envío de una inscripción, aviso en vivo a
// la familia anterior, "propio" sin fecha de nacimiento, y carreras al editar profesores y responsables.
// Requiere la API levantada en :4000 (mundo prueba-tmp-av).
import { PrismaClient } from "@prisma/client";
import { ok } from "./_check";
import { CLAVE, crearMundo, email, limpiarMundo, P } from "./_mundo-avisos";
import { PrismaAlumnoRepository } from "../src/modules/alumnos/alumno.repository.prisma";
import { PrismaPadreRepository } from "../src/modules/padres/padre.repository.prisma";
import { PrismaUsuarioRepository } from "../src/modules/usuarios/usuario.repository.prisma";
import { PrismaUnitOfWork } from "../src/core/adapters/PrismaUnitOfWork";
import { PadreService } from "../src/modules/padres/padre.service";

const API = "http://localhost:4000";
const prisma = new PrismaClient();
const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function login(quien: string): Promise<string> {
  const r = await fetch(`${API}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: email(quien), password: CLAVE }),
  });
  return ((await r.json()) as { token: string }).token;
}
interface Respuesta {
  status: number;
  d: { id?: string; error?: string; details?: Record<string, string[]> } | null;
}
async function pedir(metodo: string, ruta: string, token: string, cuerpo?: unknown): Promise<Respuesta> {
  const r = await fetch(`${API}${ruta}`, {
    method: metodo,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
  });
  const texto = await r.text();
  return { status: r.status, d: texto ? JSON.parse(texto) : null };
}
const resumen = (rs: Respuesta[]) => {
  const cuenta: Record<number, number> = {};
  for (const r of rs) cuenta[r.status] = (cuenta[r.status] ?? 0) + 1;
  return Object.keys(cuenta)
    .sort()
    .map((s) => `${s}x${cuenta[Number(s)]}`)
    .join(" ");
};
// Junta las señales `cambio` de una conexión en vivo.
function escuchar(token: string) {
  const cambios: { dato: string; accion: string; ids: Record<string, string[]> }[] = [];
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
    .catch(() => undefined);
  return { cambios, cerrar: () => control.abort() };
}

(async () => {
  const m = await crearMundo(prisma);
  const [admin, secre, familiaAnterior] = await Promise.all([login("admin"), login("secre"), login("padre")]);
  const alumno = (id: string) => prisma.alumno.findUniqueOrThrow({ where: { id } });
  const nuevo = (apellido: string) => ({ tipo: "nuevo", vinculo: "madre", datos: { nombre: "Pruebaav", apellido, telefono: "351 555-1234" } });
  const inscribir = (cuerpo: object) => pedir("POST", "/api/alumnos", secre, { cursoId: m.cursoId, ...cuerpo });

  // (a) El mismo DNI en pedidos simultáneos: uno se crea y el resto es 409 (nunca un error del servidor).
  const rondaAlumnos = await Promise.all(
    Array.from({ length: 8 }, (_, i) => inscribir({ nombre: "Pruebaav", apellido: `Carrera${i}`, dni: "99400130", responsable: nuevo(`Carrera${i}`) })),
  );
  ok("alumno: mismo DNI en 8 pedidos simultáneos", resumen(rondaAlumnos), "201x1 409x7");
  ok("alumno: quedó uno solo con ese DNI", await prisma.alumno.count({ where: { dni: "99400130" } }), 1);
  const rondaPadres = await Promise.all(
    Array.from({ length: 8 }, (_, i) => pedir("POST", "/api/padres", secre, { nombre: "Pruebaav", apellido: `Resp${i}`, telefono: "351 555-1234", dni: "99400131" })),
  );
  ok("responsable: mismo DNI en 8 pedidos simultáneos", resumen(rondaPadres), "201x1 409x7");

  // (b) Doble envío de una inscripción sin DNI con un responsable que ya existe: se crea una sola.
  const existente = { tipo: "existente", padreId: m.padreId, vinculo: "padre" };
  const antesDelDoble = await prisma.alumno.count({ where: { padreId: m.padreId } });
  const doble = await Promise.all(Array.from({ length: 6 }, () => inscribir({ nombre: "Pruebaav", apellido: "Gemelo", responsable: existente })));
  ok("doble envío simultáneo: una sola inscripción", resumen(doble), "201x1 409x5");
  const otraVez = await inscribir({ nombre: "pruebaav ", apellido: " GEMELO", responsable: existente });
  ok("doble envío después: 409 con el nombre ya cargado", `${otraVez.status} ${otraVez.d?.error}`, "409 Ese responsable ya tiene un alumno activo llamado Pruebaav Gemelo");
  ok("doble envío: quedó un alumno más", (await prisma.alumno.count({ where: { padreId: m.padreId } })) - antesDelDoble, 1);
  const otroNombre = await inscribir({ nombre: "Pruebaav", apellido: "Otrohermano", responsable: existente });
  ok("otro nombre del mismo responsable: se inscribe", otroNombre.status, 201);
  await prisma.alumno.updateMany({ where: { padreId: m.padreId, apellido: "Gemelo" }, data: { estado: "inactivo" } });
  const reinscribir = await inscribir({ nombre: "Pruebaav", apellido: "Gemelo", responsable: existente });
  ok("el mismo nombre de un alumno dado de baja: se inscribe", reinscribir.status, 201);

  // (c) La familia anterior se entera en vivo de que su hijo ya no figura con ella.
  const oyente = escuchar(familiaAnterior);
  await esperar(500);
  const reasignar = await pedir("PUT", `/api/alumnos/${m.hijo2}/responsable`, secre, { tipo: "existente", padreId: m.padreAjenoId, vinculo: "tutor" });
  await esperar(800);
  oyente.cerrar();
  const señal = oyente.cambios.find((c) => c.dato === "alumnos" && c.accion === "edicion");
  ok("reasignar el responsable: pedido", reasignar.status, 200);
  ok("la familia anterior recibe la señal", Boolean(señal), true);
  ok("la señal no trae el id del alumno que ya no es suyo", JSON.stringify(señal?.ids?.alumnoIds ?? null), "null");

  // (d) "Propio" sin fecha de nacimiento: solo en un curso de adultos.
  const propio = { tipo: "propio", telefono: "351 555-1234" };
  const sinFechaKids = await inscribir({ nombre: "Pruebaav", apellido: "AdultoKids", dni: "99400132", responsable: propio });
  ok("propio sin fecha en un curso de niños", `${sinFechaKids.status} ${sinFechaKids.d?.details && "fechaNacimiento" in sinFechaKids.d.details}`, "400 true");
  const cursoAdultos = await prisma.curso.create({ data: { id: `${P}-curso-adultos`, nombre: "Pruebaav Adultos", nivel: "adults_b1", profesorId: m.profesorId, cicloId: m.cicloId, cupo: 30, estado: "activo" } });
  const sinFechaAdultos = await inscribir({ nombre: "Pruebaav", apellido: "AdultoOk", dni: "99400133", cursoId: cursoAdultos.id, responsable: propio });
  ok("propio sin fecha en un curso de adultos", sinFechaAdultos.status, 201);
  const conFechaKids = await inscribir({ nombre: "Pruebaav", apellido: "AdultoConFecha", dni: "99400134", fechaNacimiento: "1990-01-01", responsable: propio });
  ok("propio con fecha de adulto en un curso de niños", conFechaKids.status, 201);
  await prisma.alumno.create({ data: { id: `${P}-sinfecha`, nombre: "Pruebaav", apellido: "Sinfecha", dni: "99400135", fechaInscripcion: new Date(), estado: "activo", cursoId: m.cursoId, aplicaDescuentoHermanos: false } });
  const asignarKids = await pedir("PUT", `/api/alumnos/${P}-sinfecha/responsable`, secre, propio);
  ok("asignar propio sin fecha en un curso de niños", asignarKids.status, 400);
  ok("asignar propio sin fecha: no quedó con responsable", (await alumno(`${P}-sinfecha`)).padreId, null);

  // (e) Editar nombre y apellido de un profesor con cuenta a la vez: el nombre de la cuenta siempre es "nombre apellido".
  let desparejos = 0;
  for (let i = 0; i < 20; i++) {
    await Promise.all([
      pedir("PATCH", `/api/profesores/${m.profesorId}`, admin, { nombre: `Nom${i}` }),
      pedir("PATCH", `/api/profesores/${m.profesorId}`, admin, { apellido: `Ape${i}` }),
    ]);
    const prof = await prisma.profesor.findUniqueOrThrow({ where: { id: m.profesorId } });
    const cuenta = await prisma.usuario.findUniqueOrThrow({ where: { id: m.profe } });
    if (cuenta.nombre !== `${prof.nombre} ${prof.apellido}`) desparejos++;
  }
  ok("profesor: cuenta y ficha con distinto nombre tras 20 ediciones simultáneas", desparejos, 0);

  // (f) actualizarPadre: si el alumno "propio" cambió mientras se tomaban los bloqueos, no escribe sobre un alumno que ya no
  // lo es. La carrera se simula cambiando el vínculo justo cuando el servicio pide el bloqueo del alumno.
  const fichaPropia = await prisma.padre.create({ data: { id: `${P}-ficha-propia`, nombre: "Pruebaav", apellido: "Propia", dni: "99400140" } });
  await prisma.alumno.create({
    data: { id: `${P}-alumno-propio`, nombre: "Pruebaav", apellido: "Propia", dni: "99400140", fechaInscripcion: new Date(), estado: "activo", cursoId: m.cursoId, padreId: fichaPropia.id, vinculoResponsable: "propio", aplicaDescuentoHermanos: false },
  });
  class AlumnoQueCambiaAlBloquear extends PrismaAlumnoRepository {
    override async bloquear(id: string, tx?: unknown): Promise<void> {
      await prisma.alumno.update({ where: { id }, data: { vinculoResponsable: "padre" } });
      return super.bloquear(id, tx);
    }
  }
  const servicio = new PadreService(new PrismaPadreRepository(prisma), new PrismaUsuarioRepository(prisma), new AlumnoQueCambiaAlBloquear(prisma), new PrismaUnitOfWork(prisma));
  let resultado = "sin error";
  try {
    await servicio.actualizarPadre(fichaPropia.id, { nombre: "Cambiado" });
  } catch (e) {
    resultado = (e as Error).constructor.name;
  }
  ok("actualizarPadre con el alumno propio cambiado a mitad: se rechaza", resultado, "ConflictError");
  ok("actualizarPadre: el alumno no se tocó", (await alumno(`${P}-alumno-propio`)).nombre, "Pruebaav");
  ok("actualizarPadre: la ficha no se tocó", (await prisma.padre.findUniqueOrThrow({ where: { id: fichaPropia.id } })).nombre, "Pruebaav");

  await limpiarMundo(prisma);
  await prisma.$disconnect();
})();
