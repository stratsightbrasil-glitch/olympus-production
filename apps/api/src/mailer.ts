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
      secure: process.env.SMTP_PORT === '465', // true só para porta 465 (SSL direto)
      requireTLS: process.env.SMTP_PORT !== '465', // força STARTTLS para porta 587
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS, // Para Gmail: use App Password (não a senha normal)
      },
      tls: {
        rejectUnauthorized: false, // aceita certificados autoassinados em dev
      },
    });

    // Verifica conexão antes de enviar
    await transporter.verify();

    const info = await transporter.sendMail({
      from: `"OLYMPUS · StratSight Brasil" <${process.env.SMTP_USER}>`,
      to,
      subject,
      html: htmlContent,
    });

    console.log(`[Mailer] ✅ E-mail enviado para ${to} (ID: ${info.messageId})`);
    return true;
  } catch (error: any) {
    console.error('[Mailer] ❌ Erro ao enviar e-mail:', error?.message || error);
    if (error?.message?.includes('auth') || error?.message?.includes('535')) {
      console.error('[Mailer] 💡 Dica: Para Gmail, gere uma "App Password" em myaccount.google.com/apppasswords (requer 2FA ativo) e use-a como SMTP_PASS no .env');
    }
    return false;
  }
};