import type { MensajeCorreo } from "../../core/ports";
import { escapar, fechaCorta } from "./correoHtml";

export function correoInvitacion(nombre: string, para: string, enlace: string, venceEn: Date): MensajeCorreo {
  const asunto = "Te invitamos a Babylon English Institute";
  const aclaracion = `El enlace vence el ${fechaCorta(venceEn)} y sirve una sola vez. Si venció, ingresá tu email en "¿Olvidaste tu contraseña?" y te mandamos otro.`;
  const texto = [
    `Hola ${nombre}:`,
    "",
    "Babylon English Institute te creó una cuenta para que puedas ingresar al sistema del instituto.",
    "Abrí este enlace para elegir tu contraseña y activarla:",
    "",
    enlace,
    "",
    aclaracion,
  ].join("\n");
  const html = `<div style="font-family:Arial,sans-serif;font-size:14px;color:#1f2937;max-width:480px">
  <p>Hola ${escapar(nombre)}:</p>
  <p>Babylon English Institute te creó una cuenta para que puedas ingresar al sistema del instituto.</p>
  <p><a href="${escapar(enlace)}" style="display:inline-block;background:#0F3D2E;color:#fff;padding:10px 18px;border-radius:4px;text-decoration:none">Activar mi cuenta</a></p>
  <p style="color:#6b7280;font-size:12px">${escapar(aclaracion)}</p>
</div>`;
  return { para, asunto, texto, html };
}
