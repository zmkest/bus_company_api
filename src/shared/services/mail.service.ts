import { Resend } from 'resend';
import { envs } from '../../config/envs.js';
import { InternalServerErrorException, Logger } from '@nestjs/common';

const APP_NAME = 'Bus company';

export class MailService {
  private readonly logger = new Logger('Mail Service');
  private readonly resend: Resend = new Resend(envs.resend_api_key);

  async send(subject: string, toEmails: string[], html: string) {
    const { error } = await this.resend.emails.send({
      from: envs.resend_email,
      to: toEmails,
      subject,
      html,
    });

    if (error) {
      this.logger.error(`Fallo al enviar correo a ${toEmails.join(', ')}: ${error.message}`);
      throw new InternalServerErrorException('Ocurrio un error al enviar el correo electrónico');
    }
  }

  templateHtmlResetPwd(url: string, date: Date = new Date()): string {
    return `
        <!DOCTYPE html>
        <html lang="es">
        <head>
            <meta charset="UTF-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
            <meta name="color-scheme" content="light" />
            <title>Restablecer su contraseña</title>
        </head>
        <body style="margin:0; padding:0; background-color:#f4f5f7; font-family:Arial, Helvetica, sans-serif;">
            <!-- Texto de vista previa (se ve en la bandeja de entrada) -->
            <div style="display:none; max-height:0; overflow:hidden; opacity:0;">
            Restablecimiento de contraseña en ${APP_NAME}.
            </div>

            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f4f5f7;">
            <tr>
                <td align="center" style="padding:32px 16px;">

                <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"
                        style="width:100%; max-width:600px; background-color:#ffffff; border-radius:8px; overflow:hidden;">

                    <!-- Encabezado -->
                    <tr>
                    <td align="center" style="background-color:#1f2937; padding:24px;">
                        <span style="font-size:22px; font-weight:bold; color:#ffffff;">${APP_NAME}</span>
                    </td>
                    </tr>

                    <!-- Contenido -->
                    <tr>
                    <td style="padding:32px 32px 8px 32px; color:#111827;">
                        <h1 style="margin:0 0 16px 0; font-size:22px; line-height:1.3;">Restablece tu contraseña</h1>
                        
                        <p style="margin:0 0 16px 0; font-size:15px; line-height:1.6; color:#374151;">
                        Da click en el siguiente enlace para restablecer tu contraseña.
                        </p>
                    </td>
                    </tr>

                    <!-- Link -->
                    <tr>
                    <td align="center" style="padding:0 32px 32px 32px;">
                        <a href="${url}">
                        ${url}
                        </a>
                    </td>
                    </tr>

                    <!-- Pie -->
                    <tr>
                    <td style="background-color:#f9fafb; padding:20px 32px; border-top:1px solid #e5e7eb;">
                        <p style="margin:0; font-size:12px; line-height:1.6; color:#6b7280; text-align:center;">
                        Este es un correo automático, por favor no respondas a este mensaje.<br />
                        © ${date.toLocaleString()} ${APP_NAME}. Todos los derechos reservados.
                        </p>
                    </td>
                    </tr>

                </table>

                </td>
            </tr>
            </table>
        </body>
        </html>
        `;
  }
}
