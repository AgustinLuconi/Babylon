// 3d, Tarea 4: editar escribe solo las columnas recibidas (dos ediciones de campos distintos no se pisan), "vaciar" deja
// null, el DNI se puede corregir y un DNI repetido es 409. Requiere la API levantada en :4000 (mundo prueba-tmp-av).
import { PrismaClient } from "@prisma/client";
import { ok } from "./_check";
import { CLAVE, crearMundo, email, limpiarMundo, P } from "./_mundo-avisos";
import { PrismaAlumnoRepository } from "../src/modules/alumnos/alumno.repository.prisma";

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
  d: { error?: string } | null;
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

(async () => {
  const m = await crearMundo(prisma);
  const [admin, secre] = await Promise.all(["admin", "secre"].map(login));
  const alumno = (id: string) => prisma.alumno.findUniqueOrThrow({ where: { id } });
  const padre = (id: string) => prisma.padre.findUniqueOrThrow({ where: { id } });
  const curso = (id: string) => prisma.curso.findUniqueOrThrow({ where: { id } });

  // (a) Dos ediciones de campos distintos, lanzadas a la vez, se conservan las dos (20 veces).
  const telefonos = ["351 555-1234", "11 5555 1234"];
  const normalizados = ["+5493515551234", "+5491155551234"];
  let alumnoPerdidos = 0;
  for (let i = 0; i < 20; i++) {
    await Promise.all([
      pedir("PATCH", `/api/alumnos/${m.hijo1}`, secre, { direccion: `Calle ${i}` }),
      pedir("PATCH", `/api/alumnos/${m.hijo1}`, secre, { telefono: telefonos[i % 2] }),
    ]);
    const a = await alumno(m.hijo1);
    if (a.direccion !== `Calle ${i}` || a.telefono !== normalizados[i % 2]) alumnoPerdidos++;
  }
  ok("alumno: ediciones simultáneas de campos distintos que se pisaron (de 20)", alumnoPerdidos, 0);

  // (b) Vaciar deja null, nunca "".
  await pedir("PATCH", `/api/alumnos/${m.hijo1}`, secre, { direccion: null });
  ok("alumno: dirección null se borra", (await alumno(m.hijo1)).direccion, null);
  await pedir("PATCH", `/api/alumnos/${m.hijo1}`, secre, { direccion: "algo" });
  await pedir("PATCH", `/api/alumnos/${m.hijo1}`, secre, { direccion: "   " });
  ok("alumno: dirección de puros espacios queda sin dato", (await alumno(m.hijo1)).direccion, null);

  // (c) DNI editable, normalizado, y repetido es 409.
  const dni1 = await pedir("PATCH", `/api/alumnos/${m.hijo1}`, secre, { dni: "12.345.678" });
  ok("alumno: corregir el DNI", `${dni1.status} ${(await alumno(m.hijo1)).dni}`, "200 12345678");
  const dni2 = await pedir("PATCH", `/api/alumnos/${m.hijo2}`, secre, { dni: "12345678" });
  ok("alumno: DNI repetido", `${dni2.status} ${dni2.d?.error}`, "409 Ya existe un alumno con el DNI 12345678");
  const borrarDni = await pedir("PATCH", `/api/alumnos/${m.hijo2}`, secre, { dni: null });
  ok("alumno: borrar el DNI lo deja sin dato", `${borrarDni.status} ${(await alumno(m.hijo2)).dni}`, "200 null");
  const padreDni = await pedir("PATCH", `/api/padres/${m.padreId}`, secre, { dni: "99400002" });
  ok("responsable: DNI repetido", `${padreDni.status} ${padreDni.d?.error}`, "409 Ya existe un responsable con el DNI 99400002");
  const padreDniOk = await pedir("PATCH", `/api/padres/${m.padreId}`, secre, { dni: "99.400.050" });
  ok("responsable: corregir el DNI", `${padreDniOk.status} ${(await padre(m.padreId)).dni}`, "200 99400050");

  // (d) Un dato viejo que hoy no cumple las reglas no se revalida si no se toca.
  await prisma.alumno.update({ where: { id: m.hijo1 }, data: { telefono: "2622-54555P" } });
  const otroCampo = await pedir("PATCH", `/api/alumnos/${m.hijo1}`, secre, { direccion: "B" });
  ok("alumno con teléfono viejo inválido: editar otro campo", otroCampo.status, 200);
  ok("alumno con teléfono viejo inválido: el teléfono no se toca", (await alumno(m.hijo1)).telefono, "2622-54555P");

  // (e) null en un campo obligatorio.
  ok("alumno: nombre null", (await pedir("PATCH", `/api/alumnos/${m.hijo1}`, secre, { nombre: null })).status, 400);

  // (f) Curso: cupo y aula a la vez.
  let cursoPerdidos = 0;
  for (let i = 0; i < 20; i++) {
    await Promise.all([
      pedir("PATCH", `/api/cursos/${m.cursoId}`, admin, { cupo: 20 + (i % 10) }),
      pedir("PATCH", `/api/cursos/${m.cursoId}`, admin, { aula: `Aula ${i}` }),
    ]);
    const c = await curso(m.cursoId);
    if (c.cupo !== 20 + (i % 10) || c.aula !== `Aula ${i}`) cursoPerdidos++;
  }
  ok("curso: ediciones simultáneas de cupo y aula que se pisaron (de 20)", cursoPerdidos, 0);
  await pedir("PATCH", `/api/cursos/${m.cursoId}`, admin, { aula: null });
  ok("curso: aula null se borra", (await curso(m.cursoId)).aula, null);

  // (g) Cambiar de curso sigue moviendo la inscripción del ciclo activo.
  await pedir("PATCH", `/api/alumnos/${m.hijo1}`, secre, { cursoId: m.cursoMultiId });
  const insc = await prisma.inscripcion.findFirstOrThrow({ where: { alumnoId: m.hijo1, cicloId: m.cicloId } });
  ok("alumno: cambiar de curso mueve la inscripción", insc.cursoId, m.cursoMultiId);

  // (h) Responsable: borrar el email.
  const sinCuenta = await prisma.padre.create({ data: { id: `${P}-sincuenta`, nombre: "Pruebaav", apellido: "Sincuenta", dni: "99400060", email: "sin@cuenta.test" } });
  const borrarEmailSinCuenta = await pedir("PATCH", `/api/padres/${sinCuenta.id}`, secre, { email: null });
  ok("responsable sin cuenta: borrar el email", `${borrarEmailSinCuenta.status} ${(await padre(sinCuenta.id)).email}`, "200 null");
  const borrarEmailConCuenta = await pedir("PATCH", `/api/padres/${m.padreId}`, secre, { email: null });
  ok("responsable con cuenta: no se puede borrar el email", borrarEmailConCuenta.status, 400);

  // (i) Profesor: teléfono normalizado y borrable.
  const tel = await pedir("PATCH", `/api/profesores/${m.profesorId}`, admin, { telefono: "0351 15 555 1234" });
  ok("profesor: teléfono normalizado", `${tel.status} ${(await prisma.profesor.findUniqueOrThrow({ where: { id: m.profesorId } })).telefono}`, "200 +5493515551234");
  await pedir("PATCH", `/api/profesores/${m.profesorId}`, admin, { telefono: null });
  ok("profesor: teléfono null se borra", (await prisma.profesor.findUniqueOrThrow({ where: { id: m.profesorId } })).telefono, null);

  // (j) bloquear(): una escritura sobre la fila bloqueada espera a que termine la transacción que la bloqueó.
  const repo = new PrismaAlumnoRepository(prisma);
  let escribio = false;
  await prisma.$transaction(async (tx) => {
    await repo.bloquear(m.hijo2, tx);
    const otra = repo.actualizarParcial(m.hijo2, { observacionesMedicas: "x" }).then(() => {
      escribio = true;
    });
    await esperar(400);
    ok("bloquear: la otra escritura espera", escribio, false);
    void otra;
  });
  await esperar(300);
  ok("bloquear: al terminar la transacción, la otra escritura avanza", escribio, true);

  // (k) Un curso que no existe es 404 (no un error del servidor) y no cambia nada.
  const cursoAntes = (await alumno(m.hijo1)).cursoId;
  const sinCurso = await pedir("PATCH", `/api/alumnos/${m.hijo1}`, secre, { cursoId: "no-existe" });
  ok("alumno: un curso que no existe es 404", sinCurso.status, 404);
  ok("alumno: el curso no cambió", (await alumno(m.hijo1)).cursoId, cursoAntes);

  await limpiarMundo(prisma);
  await prisma.$disconnect();
})();
