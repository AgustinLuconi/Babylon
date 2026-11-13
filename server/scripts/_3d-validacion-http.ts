// 3d, Tarea 3: cada esquema rechaza con un 400 (y el campo que falló) los datos inválidos, y nunca hay un 500.
// Requiere la API levantada en :4000. Usa el mundo de prueba (prefijo prueba-tmp-av) y no deja nada creado.
import { PrismaClient } from "@prisma/client";
import { ok } from "./_check";
import { CLAVE, crearMundo, email, limpiarMundo } from "./_mundo-avisos";

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
interface Respuesta {
  status: number;
  d: { error?: string; details?: Record<string, string[]> } | null;
}
async function pedir(metodo: string, ruta: string, token: string, cuerpo?: unknown, crudo?: string): Promise<Respuesta> {
  const r = await fetch(`${API}${ruta}`, {
    method: metodo,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: crudo ?? (cuerpo === undefined ? undefined : JSON.stringify(cuerpo)),
  });
  const texto = await r.text();
  let d = null;
  try {
    d = texto ? JSON.parse(texto) : null;
  } catch {
    /* respuesta que no es JSON */
  }
  return { status: r.status, d };
}
// "400:campo" si el servidor rechazó con ese campo en el detalle; "400:sin-campo" si rechazó sin nombrarlo.
const rechazo = (r: Respuesta, campo: string) => `${r.status}:${r.status === 400 && r.d?.details && campo in r.d.details ? campo : "sin-campo"}`;
const largo = (n: number) => "x".repeat(n);
const diasAdelante = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);

(async () => {
  const m = await crearMundo(prisma);
  const [admin, secre, profe, padre] = await Promise.all(["admin", "secre", "profe", "padre"].map(login));

  // ── Datos inválidos: 400 y el campo ──
  const basePadre = { nombre: "Pruebaav", apellido: "Val", dni: "99400101", email: email("val1"), telefono: "351 555-1234" };
  const crearPadre = (cambios: object) => pedir("POST", "/api/padres", secre, { ...basePadre, ...cambios });
  ok("padre: nombre de puros espacios", rechazo(await crearPadre({ nombre: "   " }), "nombre"), "400:nombre");
  ok("padre: DNI con letras", rechazo(await crearPadre({ dni: "12A" }), "dni"), "400:dni");
  ok("padre: teléfono que no es un celular", rechazo(await crearPadre({ telefono: "hola" }), "telefono"), "400:telefono");
  ok("padre: email inválido", rechazo(await crearPadre({ email: "x" }), "email"), "400:email");
  ok("padre: apellido de 61 caracteres", rechazo(await crearPadre({ apellido: largo(61) }), "apellido"), "400:apellido");

  const baseAlumno = { nombre: "Pruebaav", apellido: "Nuevo", dni: "99400102", fechaNacimiento: "2015-03-04", responsable: { tipo: "existente", padreId: m.padreId, vinculo: "madre" }, cursoId: m.cursoId };
  const inscribir = (cambios: object) => pedir("POST", "/api/alumnos", secre, { ...baseAlumno, ...cambios });
  ok("alumno: fecha de nacimiento futura", rechazo(await inscribir({ fechaNacimiento: diasAdelante(30) }), "fechaNacimiento"), "400:fechaNacimiento");
  ok("alumno: fecha de nacimiento 1800", rechazo(await inscribir({ fechaNacimiento: "1800-01-01" }), "fechaNacimiento"), "400:fechaNacimiento");
  ok("alumno: teléfono inválido", rechazo(await inscribir({ telefono: "hola" }), "telefono"), "400:telefono");
  ok("alumno: email inválido", rechazo(await inscribir({ email: "x" }), "email"), "400:email");
  ok("alumno: dirección de 151 caracteres", rechazo(await inscribir({ direccion: largo(151) }), "direccion"), "400:direccion");
  ok("alumno: nombre de puros espacios", rechazo(await inscribir({ nombre: "   " }), "nombre"), "400:nombre");

  const anidado = await inscribir({ nombre: "Pruebaav", apellido: "Anidado", responsable: { tipo: "nuevo", vinculo: "madre", datos: { nombre: "Pruebaav", apellido: "Resp", telefono: "hola" } } });
  ok("alumno: un error dentro del responsable trae su ruta completa", `${anidado.status} ${anidado.d?.details && "responsable.datos.telefono" in anidado.d.details}`, "400 true");

  const editar = (cuerpo: unknown) => pedir("PATCH", `/api/alumnos/${m.hijo1}`, secre, cuerpo);
  ok("editar alumno: nombre de puros espacios", rechazo(await editar({ nombre: "   " }), "nombre"), "400:nombre");
  ok("editar alumno: nombre null", rechazo(await editar({ nombre: null }), "nombre"), "400:nombre");
  ok("editar alumno: teléfono inválido", rechazo(await editar({ telefono: "hola" }), "telefono"), "400:telefono");
  ok("editar alumno: dirección null (se borra)", (await editar({ direccion: null })).status, 200);

  const baseCurso = { nombre: "Pruebaav Curso", nivel: "kids", profesorId: m.profesorId, cupo: 10, horarios: [{ diaSemana: "lunes", horaInicio: "10:00", horaFin: "11:00" }] };
  const crearCurso = (cambios: object) => pedir("POST", "/api/cursos", admin, { ...baseCurso, ...cambios });
  const horario = (horaInicio: string, horaFin: string) => ({ diaSemana: "lunes", horaInicio, horaFin });
  ok("curso: horario que termina antes de empezar", rechazo(await crearCurso({ horarios: [horario("18:00", "17:00")] }), "horarios"), "400:horarios");
  ok("curso: dos horarios que se pisan", rechazo(await crearCurso({ horarios: [horario("10:00", "12:00"), horario("11:00", "13:00")] }), "horarios"), "400:horarios");
  ok("curso: cupo 0", rechazo(await crearCurso({ cupo: 0 }), "cupo"), "400:cupo");
  ok("curso: cupo 51", rechazo(await crearCurso({ cupo: 51 }), "cupo"), "400:cupo");
  ok("curso: nombre de 81 caracteres", rechazo(await crearCurso({ nombre: largo(81) }), "nombre"), "400:nombre");

  const miChat = await pedir("GET", "/api/chats/mio", padre);
  const chatId = (miChat.d as unknown as { id: string }).id;
  ok("chat: mensaje de 2001 caracteres", rechazo(await pedir("POST", `/api/chats/${chatId}/mensajes`, padre, { texto: largo(2001) }), "texto"), "400:texto");
  ok("chat: mensaje de puros espacios", rechazo(await pedir("POST", `/api/chats/${chatId}/mensajes`, padre, { texto: "   " }), "texto"), "400:texto");

  const evaluacion = { cursoId: m.cursoId, nombre: "Unit", tipo: "examen", fecha: diasAdelante(5), periodo: "noviembre" };
  const crearEvaluacion = (cambios: object) => pedir("POST", "/api/calificaciones/evaluaciones", profe, { ...evaluacion, ...cambios });
  ok("evaluación: fecha a dos años", rechazo(await crearEvaluacion({ fecha: diasAdelante(730) }), "fecha"), "400:fecha");
  ok("evaluación: nombre de 81 caracteres", rechazo(await crearEvaluacion({ nombre: largo(81) }), "nombre"), "400:nombre");
  ok("asistencia: fecha de pasado mañana", rechazo(await pedir("POST", "/api/asistencia/masiva", profe, { cursoId: m.cursoId, fecha: diasAdelante(2), registros: [{ alumnoId: m.hijo1, estado: "presente" }] }), "fecha"), "400:fecha");
  ok("observación: texto de 1001 caracteres", rechazo(await pedir("POST", "/api/observaciones", profe, { alumnoId: m.hijo1, texto: largo(1001), categoria: "academico" }), "texto"), "400:texto");

  // ── Cuerpos mal formados: siempre 400, nunca 500 ──
  const cuerpos: [string, string][] = [["null", "null"], ["un arreglo", "[]"], ["un número donde va texto", '{"nombre":5}'], ["un campo desconocido", '{"x":1}']];
  const destinos: [string, string, string][] = [
    ["POST", "/api/padres", secre],
    ["POST", "/api/alumnos", secre],
    ["PATCH", `/api/alumnos/${m.hijo1}`, secre],
    ["PATCH", `/api/padres/${m.padreId}`, secre],
    ["POST", "/api/profesores", admin],
    ["PATCH", `/api/profesores/${m.profesorId}`, admin],
    ["POST", "/api/cursos", admin],
    ["PATCH", `/api/cursos/${m.cursoId}`, admin],
    ["POST", "/api/auth/cuentas", admin],
    ["POST", "/api/ciclos", admin],
    ["PATCH", "/api/configuracion", admin],
    ["POST", "/api/cuotas/pagos", secre],
    ["POST", "/api/observaciones", profe],
    ["POST", "/api/observaciones/categorias", profe],
    ["POST", "/api/calificaciones/evaluaciones", profe],
    ["POST", "/api/calificaciones/notas-cierre", profe],
    ["POST", "/api/asistencia/masiva", profe],
    ["POST", `/api/chats/${chatId}/mensajes`, padre],
  ];
  for (const [metodo, ruta, token] of destinos) {
    for (const [nombre, crudo] of cuerpos) {
      ok(`${metodo} ${ruta.replace(/\/[^/]*\d[^/]*$/, "/:id")} con ${nombre}`, (await pedir(metodo, ruta, token, undefined, crudo)).status, 400);
    }
  }

  // (Que borrar un dato opcional deje null, y no "", se prueba en _3d-parcial.ts: depende de las escrituras parciales.)
  await limpiarMundo(prisma);
  await prisma.$disconnect();
})();
