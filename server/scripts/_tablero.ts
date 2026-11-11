import { PrismaClient } from "@prisma/client";
import { PrismaUnitOfWork } from "../src/core/adapters/PrismaUnitOfWork";
import { TableroDeAnuncios } from "../src/core/eventos";
import { ok } from "./_check";

interface Eventos {
  "prueba.hecha": { id: string };
}
const prisma = new PrismaClient();
const uow = new PrismaUnitOfWork(prisma);
const P = "prueba-tmp-av-tab";
const esperar = () => new Promise((r) => setTimeout(r, 80));
const crearUsuario = (tx: unknown, id: string) =>
  ((tx as PrismaClient | undefined) ?? prisma).usuario.create({
    data: { id, nombre: "Prueba", email: `${id}@x.test`, passwordHash: "x", roles: ["padre"], estado: "activo", fechaCreacion: new Date() },
  });
const existe = async (id: string) => ((await prisma.usuario.count({ where: { id } })) === 1 ? "sí" : "no");
const corrio = (lista: string[], id: string) => (lista.includes(id) ? "sí" : "no");

(async () => {
  await prisma.usuario.deleteMany({ where: { id: { startsWith: P } } });
  const tablero = new TableroDeAnuncios<Eventos>();
  const despues: string[] = [];
  let fallarDentro = false;
  tablero.alPublicarse("prueba.hecha", async ({ id }, tx) => {
    await crearUsuario(tx, `${id}-dentro`);
    if (fallarDentro) throw new Error("falla adentro (simulada)");
  });
  tablero.alConfirmarse("prueba.hecha", ({ id }) => {
    despues.push(id);
  });

  // 1) Todo bien: lo de adentro se guarda con la operación y lo de después corre recién al confirmar
  let antes = "";
  await uow.runInTransaction(async (tx) => {
    await crearUsuario(tx, `${P}-1`);
    await tablero.publicar("prueba.hecha", { id: `${P}-1` }, tx);
    await esperar();
    antes = corrio(despues, `${P}-1`);
  });
  await esperar();
  ok("1: 'después' antes de confirmar", antes, "no");
  ok("1: 'después' al confirmar", corrio(despues, `${P}-1`), "sí");
  ok("1: se guardó lo de adentro", await existe(`${P}-1-dentro`), "sí");

  // 2) Falla adentro: se deshace la operación entera y 'después' no corre
  fallarDentro = true;
  const r2 = await uow
    .runInTransaction(async (tx) => {
      await crearUsuario(tx, `${P}-2`);
      await tablero.publicar("prueba.hecha", { id: `${P}-2` }, tx);
    })
    .then(() => "ok", (e: Error) => e.message);
  fallarDentro = false;
  await esperar();
  ok("2: la operación falla", r2, "falla adentro (simulada)");
  ok("2: la fila de la operación no quedó", await existe(`${P}-2`), "no");
  ok("2: 'después' no corrió", corrio(despues, `${P}-2`), "no");

  // 3) La operación falla después de publicar: lo de adentro se deshace y 'después' se descarta
  const r3 = await uow
    .runInTransaction(async (tx) => {
      await tablero.publicar("prueba.hecha", { id: `${P}-3` }, tx);
      throw new Error("falla posterior");
    })
    .then(() => "ok", (e: Error) => e.message);
  await esperar();
  ok("3: la operación falla", r3, "falla posterior");
  ok("3: lo de adentro se deshizo", await existe(`${P}-3-dentro`), "no");
  ok("3: 'después' no corrió", corrio(despues, `${P}-3`), "no");

  // 4) Sin transacción todo corre en el momento
  await tablero.publicar("prueba.hecha", { id: `${P}-4` });
  await esperar();
  ok("4: adentro corrió sin transacción", await existe(`${P}-4-dentro`), "sí");
  ok("4: 'después' corrió sin transacción", corrio(despues, `${P}-4`), "sí");

  // 5) Un 'después' que falla no afecta a la operación ni a los demás
  const original = console.error;
  const errores: string[] = [];
  console.error = (...a: unknown[]) => void errores.push(a.map(String).join(" "));
  tablero.alConfirmarse("prueba.hecha", () => {
    throw new Error("señal caída (simulada)");
  });
  const r5 = await uow.runInTransaction(async (tx) => {
    await tablero.publicar("prueba.hecha", { id: `${P}-5` }, tx);
    return "listo";
  });
  await esperar();
  console.error = original;
  ok("5: la operación termina bien", r5, "listo");
  ok("5: el otro 'después' corrió", corrio(despues, `${P}-5`), "sí");
  ok("5: la falla quedó en el log", errores.some((e) => e.includes("[alConfirmar]")) ? "sí" : "no", "sí");

  await prisma.usuario.deleteMany({ where: { id: { startsWith: P } } });
  ok("limpieza", await prisma.usuario.count({ where: { id: { startsWith: P } } }), 0);
  await prisma.$disconnect();
})();
