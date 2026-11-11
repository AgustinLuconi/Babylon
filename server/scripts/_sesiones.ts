import { PrismaClient } from "@prisma/client";
import { container } from "../src/container";
import { ok } from "./_check";

const prisma = new PrismaClient();
(async () => {
  const p6 = await prisma.usuario.findFirstOrThrow({ where: { email: "p6@prueba.babylon.test" } });
  const ahora = new Date();
  const abiertas = () => prisma.sesion.count({ where: { usuarioId: p6.id, cerradaEn: null, expiraEn: { gt: new Date() } } });
  await prisma.sesion.createMany({
    data: [1, 2].map((i) => ({ id: `prueba-tmp-rec${i}`, usuarioId: p6.id, dispositivo: "x", ip: null, creadaEn: ahora, ultimoUsoEn: ahora, expiraEn: new Date(ahora.getTime() + 3_600_000) })),
  });
  const antes = await abiertas();
  await container.usuarioService.actualizarCuenta(p6.id, { password: "NuevaClave12345" }, { usuarioId: "otro-admin", sesionId: "ninguna" });
  ok("el administrador cambia la contraseña: había sesiones abiertas", antes >= 2 ? "2 o más" : antes, "2 o más");
  ok("el administrador cambia la contraseña: sesiones abiertas después", await abiertas(), 0);
  await prisma.usuario.update({ where: { id: p6.id }, data: { passwordHash: p6.passwordHash } });
  await prisma.sesion.deleteMany({ where: { id: { startsWith: "prueba-tmp-rec" } } });
  await prisma.$disconnect();
  process.exit(0);
})();
