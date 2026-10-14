import type { MensajeCorreo } from "../../core/ports";
import { escapar } from "./correoHtml";

export function correoVerificacion(nombre: string, para: string, enlace: string): MensajeCorreo {
  const asunto = "Verificá tu email — Babylon English Institute";
  const aclaracion = "El enlace vence en 24 horas y sirve una sola vez. Si no lo pediste, ignorá este correo.";
  const texto = [`Hola ${nombre}:`, "", "Abrí este enlace para confirmar que este email es tuyo:", "", enlace, "", aclaracion].join("\n");
  const html = `<div style="font-family:Arial,sans-serif;font-size:14px;color:#1f2937;max-width:480px">
  <p>Hola ${escapar(nombre)}:</p>
  <p>Abrí este enlace para confirmar que este email es tuyo.</p>
  <p><a href="${escapar(enlace)}" style="display:inline-block;background:#0F3D2E;color:#fff;padding:10px 18px;border-radius:4px;text-decoration:none">Verificar mi email</a></p>
  <p style="color:#6b7280;font-size:12px">${escapar(aclaracion)}</p>
</div>`;
  return { para, asunto, texto, html };
}
