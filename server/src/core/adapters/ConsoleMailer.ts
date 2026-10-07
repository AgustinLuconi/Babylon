import type { Mailer, MensajeCorreo } from "../ports";

// Desarrollo: no envía nada, escribe el correo en la consola del server
// (ahí se lee, por ejemplo, el enlace de recuperación de contraseña).
export class ConsoleMailer implements Mailer {
  async enviar({ para, asunto, texto }: MensajeCorreo): Promise<void> {
    console.log(`[correo] para: ${para}\n[correo] asunto: ${asunto}\n${texto}\n[correo] ———`);
  }
}
