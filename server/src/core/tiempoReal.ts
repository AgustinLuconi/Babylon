import { Router, type Request, type Response } from "express";
import { authMiddleware } from "./middlewares/authMiddleware";
import { limiteTiempoReal } from "./middlewares/limitesDePedidos";
import type { CanalEnVivo, MotivoCierre, SenalEnVivo, ValidadorDeSesion } from "./ports";
import { VERSION_SERVIDOR } from "./version";

const LATIDO_MS = 25 * 1000;
const REVALIDAR_MS = 5 * 60 * 1000;
// setTimeout no acepta esperas de más de ~24,8 días: más allá, la revalidación periódica detecta el vencimiento.
const ESPERA_MAXIMA_MS = 2_147_483_647;

// Conexión en vivo (SSE): el servidor manda señales y el navegador solo escucha. Una por sesión. Se abre con el mismo
// encabezado Authorization y la misma validación que el resto de la API, nunca con el token en la dirección (quedaría
// en los registros). Se corta al vencer el token, cuando se cierra la sesión (lo avisa el canal) y, como red de
// seguridad, si al revalidarla cada 5 minutos ya no vale.
export function tiempoRealRoutes(canal: CanalEnVivo, validar: ValidadorDeSesion): Router {
  const router = Router();
  router.get("/", authMiddleware, limiteTiempoReal, (req: Request, res: Response) => {
    const { sub: usuarioId, rol, sesionId, expiraEn } = req.auth!;
    res.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      // Que ningún proxy (nginx y similares) acumule los mensajes antes de mandarlos.
      "X-Accel-Buffering": "no",
    });
    res.flushHeaders();

    let abierta = true;
    let latido: NodeJS.Timeout | undefined;
    let revision: NodeJS.Timeout | undefined;
    let vencimiento: NodeJS.Timeout | undefined;
    let quitar = () => {};
    const enviar = (senal: SenalEnVivo) => {
      if (abierta) res.write(`event: ${senal.tipo}\ndata: ${JSON.stringify(senal.datos ?? {})}\n\n`);
    };
    const cerrar = () => {
      if (!abierta) return;
      abierta = false;
      clearInterval(latido);
      clearInterval(revision);
      clearTimeout(vencimiento);
      quitar();
      res.end();
    };
    const cortar = (motivo: MotivoCierre) => {
      enviar({ tipo: "sesion-cerrada", datos: { motivo } });
      cerrar();
    };

    quitar = canal.registrar({ sesionId, usuarioId, rol, enviar, cerrar });
    enviar({ tipo: "listo", datos: { version: VERSION_SERVIDOR } });
    latido = setInterval(() => {
      if (abierta) res.write(": latido\n\n");
    }, LATIDO_MS);
    revision = setInterval(() => {
      validar(sesionId, usuarioId).then(
        (valida) => {
          if (!valida) cortar("vencida");
        },
        () => {},
      );
    }, REVALIDAR_MS);
    if (expiraEn) {
      const espera = expiraEn.getTime() - Date.now();
      if (espera <= ESPERA_MAXIMA_MS) vencimiento = setTimeout(() => cortar("vencida"), Math.max(espera, 0));
    }
    req.on("close", cerrar);
  });
  return router;
}
