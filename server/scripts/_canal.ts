import { CanalEnMemoria } from "../src/core/adapters/CanalEnMemoria";
import type { Rol, SenalEnVivo } from "../src/core/ports";
import { ok } from "./_check";

const validas = new Set(["s1", "s2", "s3"]);
const canal = new CanalEnMemoria(async (sesionId) => validas.has(sesionId));
const conectar = (sesionId: string, usuarioId: string, rol: Rol) => {
  const c = {
    sesionId,
    usuarioId,
    rol,
    recibidas: [] as string[],
    cerrada: false,
    enviar(s: SenalEnVivo) {
      c.recibidas.push(s.datos === undefined ? s.tipo : `${s.tipo} ${JSON.stringify(s.datos)}`);
    },
    cerrar() {
      c.cerrada = true;
      quitar();
    },
  };
  const quitar = canal.registrar(c);
  return c;
};

(async () => {
  const comoAdmin = conectar("s1", "u1", "admin");
  const comoProfesora = conectar("s2", "u1", "profesor");
  const otra = conectar("s3", "u2", "padre");
  canal.enviarA("u1", "admin", { tipo: "notificaciones", datos: { noLeidas: 3 } });
  ok("la señal llega a la cuenta en ese rol", comoAdmin.recibidas.join(), 'notificaciones {"noLeidas":3}');
  ok("no llega a la misma cuenta en otro rol", comoProfesora.recibidas.length, 0);
  ok("no llega a otra cuenta", otra.recibidas.length, 0);
  ok("conectado en ese rol", canal.conectado("u1", "admin") ? "sí" : "no", "sí");
  ok("no conectado en un rol sin conexión", canal.conectado("u2", "admin") ? "sí" : "no", "no");

  const reemplazo = conectar("s1", "u1", "admin");
  ok("la conexión anterior de la sesión se avisa", comoAdmin.recibidas.at(-1), "reemplazada");
  ok("y se cierra", comoAdmin.cerrada ? "sí" : "no", "sí");
  canal.enviarA("u1", "admin", { tipo: "notificaciones", datos: { noLeidas: 4 } });
  ok("las señales van a la nueva", reemplazo.recibidas.join(), 'notificaciones {"noLeidas":4}');
  ok("la anterior no recibe más", comoAdmin.recibidas.length, 2);

  validas.delete("s2");
  await canal.revisarSesiones("u1", "cerrada-desde-otro-dispositivo");
  ok("la sesión cerrada recibe el motivo", comoProfesora.recibidas.join(), 'sesion-cerrada {"motivo":"cerrada-desde-otro-dispositivo"}');
  ok("y se corta", comoProfesora.cerrada ? "sí" : "no", "sí");
  ok("la que sigue valiendo queda abierta", reemplazo.cerrada ? "sí" : "no", "no");
  ok("después del corte no figura conectada", canal.conectado("u1", "profesor") ? "sí" : "no", "no");
  ok("otra cuenta no se revisa", otra.cerrada ? "sí" : "no", "no");

  const secretaria = conectar("s4", "u3", "secretario");
  canal.enviarARoles(["admin", "secretario"], { tipo: "chat", datos: { chatId: "c1" } });
  ok("a todos los de esos roles", reemplazo.recibidas.at(-1), 'chat {"chatId":"c1"}');
  ok("también a otra cuenta con otro de esos roles", secretaria.recibidas.join(), 'chat {"chatId":"c1"}');
  ok("no a otros roles", otra.recibidas.length, 0);
})();
