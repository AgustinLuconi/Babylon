// Entidad secundaria de usuarios/: enlace de un solo uso que se manda por correo.
export type TipoTokenCuenta = "recuperacion" | "invitacion" | "verificacion_email";

export interface TokenCuenta {
  id: string;
  usuarioId: string;
  tipo: TipoTokenCuenta;
  // SHA-256 (hex) del token; el token en sí nunca se guarda.
  hash: string;
  creadoEn: Date;
  expiraEn: Date;
  usadoEn: Date | null;
}

const UNA_HORA_MS = 60 * 60 * 1000;

export const VIGENCIA_TOKEN_MS: Record<TipoTokenCuenta, number> = {
  recuperacion: UNA_HORA_MS,
  invitacion: 7 * 24 * UNA_HORA_MS,
  verificacion_email: 24 * UNA_HORA_MS,
};
