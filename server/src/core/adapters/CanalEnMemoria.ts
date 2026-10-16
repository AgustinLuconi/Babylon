import type { CanalEnVivo, ConexionEnVivo, MotivoCierre, Rol, SenalEnVivo, ValidadorDeSesion } from "../ports";

// Conexiones abiertas en la memoria de este proceso: una por sesión. Alcanza con un solo servidor.
export class CanalEnMemoria implements CanalEnVivo {
  private readonly porSesion = new Map<string, ConexionEnVivo>();

  constructor(private readonly validar: ValidadorDeSesion) {}

  registrar(conexion: ConexionEnVivo): () => void {
    const anterior = this.porSesion.get(conexion.sesionId);
    if (anterior) {
      anterior.enviar({ tipo: "reemplazada" });
      anterior.cerrar();
    }
    this.porSesion.set(conexion.sesionId, conexion);
    return () => {
      if (this.porSesion.get(conexion.sesionId) === conexion) this.porSesion.delete(conexion.sesionId);
    };
  }

  enviarA(usuarioId: string, rol: Rol, senal: SenalEnVivo): void {
    for (const c of this.porSesion.values()) if (c.usuarioId === usuarioId && c.rol === rol) c.enviar(senal);
  }

  conectado(usuarioId: string, rol: Rol): boolean {
    for (const c of this.porSesion.values()) if (c.usuarioId === usuarioId && c.rol === rol) return true;
    return false;
  }

  async revisarSesiones(usuarioId: string, motivo: MotivoCierre): Promise<void> {
    for (const c of [...this.porSesion.values()]) {
      if (c.usuarioId !== usuarioId || (await this.validar(c.sesionId, c.usuarioId))) continue;
      c.enviar({ tipo: "sesion-cerrada", datos: { motivo } });
      c.cerrar();
    }
  }
}
