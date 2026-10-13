import { createHash, randomBytes, randomUUID } from "node:crypto";
import { VIGENCIA_TOKEN_MS, type TipoTokenCuenta, type TokenCuenta } from "./tokenCuenta.entity";

export const hashDeToken = (token: string) => createHash("sha256").update(token).digest("hex");

// Un enlace nuevo: el token (viaja solo en el correo) y la fila que se guarda (con su SHA-256 y su vencimiento).
export function nuevoEnlace(usuarioId: string, tipo: TipoTokenCuenta, ahora: Date): { token: string; registro: TokenCuenta } {
  const token = randomBytes(32).toString("base64url");
  return {
    token,
    registro: {
      id: randomUUID(),
      usuarioId,
      tipo,
      hash: hashDeToken(token),
      creadoEn: ahora,
      expiraEn: new Date(ahora.getTime() + VIGENCIA_TOKEN_MS[tipo]),
      usadoEn: null,
    },
  };
}

// Sin usar y sin vencer.
export const enlaceVigente = (t: TokenCuenta, ahora: Date) => t.usadoEn === null && t.expiraEn.getTime() > ahora.getTime();
