// La recarga espera a que pasen 300 ms sin señales, pero nunca más que el máximo: con señales que no paran, igual recarga.
import { crearProgramador } from "../../client/src/features/cambios/programador";
import { ok } from "./_check";

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));
(async () => {
  let llamadas = 0;
  const p = crearProgramador(() => void llamadas++, 300, 1000);
  for (let i = 0; i < 5; i++) {
    p.programar();
    await esperar(50);
  }
  await esperar(500);
  ok("una ráfaga corta: una sola recarga", llamadas, 1);
  llamadas = 0;
  for (let i = 0; i < 25; i++) {
    p.programar();
    await esperar(100);
  }
  ok("señales que no paran durante 2,5 s: igual recarga (al menos 2 veces)", llamadas >= 2 ? "sí" : "no", "sí");
  p.cancelar();
})();
