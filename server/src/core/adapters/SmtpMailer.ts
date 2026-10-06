import nodemailer, { type Transporter } from "nodemailer";
import type { Mailer, MensajeCorreo } from "../ports";

export interface OpcionesSmtp {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
}

// Cualquier servidor SMTP: Gmail del instituto (con contraseña de aplicación),
// Resend, Brevo, el del hosting, etc.
export class SmtpMailer implements Mailer {
  private readonly transporte: Transporter;

  constructor(private readonly opciones: OpcionesSmtp) {
    this.transporte = nodemailer.createTransport({
      host: opciones.host,
      port: opciones.port,
      secure: opciones.secure,
      auth: { user: opciones.user, pass: opciones.pass },
    });
  }

  async enviar({ para, asunto, texto, html }: MensajeCorreo): Promise<void> {
    await this.transporte.sendMail({ from: this.opciones.from, to: para, subject: asunto, text: texto, html });
  }
}
