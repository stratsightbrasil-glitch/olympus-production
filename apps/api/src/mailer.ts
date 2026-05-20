import nodemailer from 'nodemailer';

export const sendEmail = async (to: string, subject: string, htmlContent: string) => {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER) {
    console.log(`\n[Mailer - MOCK] E-mail simulado com sucesso!`);
    console.log(`[Para]: ${to}\n[Assunto]: ${subject}\n`);
    return true;
  }

  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_PORT === '465',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    const info = await transporter.sendMail({
      from: `"OLYMPUS Orquestrador" <${process.env.SMTP_USER}>`,
      to,
      subject,
      html: htmlContent,
    });

    console.log(`[Mailer] E-mail enviado com sucesso para ${to} (ID: ${info.messageId})`);
    return true;
  } catch (error) {
    console.error('[Mailer] Erro crítico ao tentar enviar e-mail:', error);
    return false;
  }
};