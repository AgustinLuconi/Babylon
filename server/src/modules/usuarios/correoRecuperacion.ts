import type { MensajeCorreo } from "../../core/ports";

const escapar = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function correoRecuperacion(nombre: string, para: string, enlace: string): MensajeCorreo {
  const asunto = "Restablecé tu contraseña — Babylon English Institute";
  const texto = [
    `Hola ${nombre}:`,
    "",
    "Recibimos un pedido para restablecer la contraseña de tu cuenta en Babylon.",
    "Abrí este enlace para elegir una nueva (vence en 1 hora y sirve una sola vez):",
    "",
    enlace,
    "",
    "Si no pediste este cambio, ignorá este correo: tu contraseña sigue siendo la misma.",
  ].join("\n");
  const html = `<div style="font-family:Arial,sans-serif;font-size:14px;color:#1f2937;max-width:480px">
  <p>Hola ${escapar(nombre)}:</p>
  <p>Recibimos un pedido para restablecer la contraseña de tu cuenta en Babylon.</p>
  <p><a href="${escapar(enlace)}" style="display:inline-block;background:#0F3D2E;color:#fff;padding:10px 18px;border-radius:4px;text-decoration:none">Elegir una contraseña nueva</a></p>
  <p style="color:#6b7280;font-size:12px">El enlace vence en 1 hora y sirve una sola vez. Si no pediste este cambio, ignorá este correo: tu contraseña sigue siendo la misma.</p>
</div>`;
  return { para, asunto, texto, html };
}
