import { programarTareaDiaria } from "../../core/tareaDiaria";
import type { UsuarioService } from "./usuario.service";

// Depuración de sesiones terminadas (cerradas o vencidas hace más de 90 días): misma tarea diaria de las 03:00.
export function iniciarDepuracionDeSesiones(usuarioService: UsuarioService): void {
  programarTareaDiaria("sesiones", async () => {
    const borradas = await usuarioService.depurarSesionesTerminadas();
    if (borradas > 0) console.log(`[sesiones] ${borradas} sesión(es) terminada(s) hace más de 90 días borrada(s)`);
  });
}
