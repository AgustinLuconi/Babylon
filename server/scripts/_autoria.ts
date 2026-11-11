import { autorActual, ejecutarComo } from "../src/core/autoria";
import { ok } from "./_check";

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));
const quien = () => autorActual()?.usuarioId ?? "nadie";

(async () => {
  ok("afuera no hay autor", quien(), "nadie");
  const dentro = await ejecutarComo({ usuarioId: "u1", rol: "secretario" }, async () => {
    await esperar(5);
    await Promise.resolve();
    return new Promise<string>((r) => setTimeout(() => r(quien()), 5));
  });
  ok("se conserva después de await y setTimeout", dentro, "u1");
  ok("el rol también", ejecutarComo({ usuarioId: "u2", rol: "padre" }, () => autorActual()?.rol), "padre");
  const [a, b] = await Promise.all([
    ejecutarComo({ usuarioId: "a", rol: "admin" }, async () => (await esperar(20), quien())),
    ejecutarComo({ usuarioId: "b", rol: "admin" }, async () => (await esperar(5), quien())),
  ]);
  ok("dos en paralelo no se mezclan", `${a} ${b}`, "a b");
  ok("al salir vuelve a no haber autor", quien(), "nadie");
})();
