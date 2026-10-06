// Entidad secundaria de usuarios/: enlace de recuperación de contraseña.
export interface TokenRecuperacion {
  id: string;
  usuarioId: string;
  // SHA-256 (hex) del token; el token en sí nunca se guarda.
  hash: string;
  creadoEn: Date;
  expiraEn: Date;
  usadoEn: Date | null;
}
