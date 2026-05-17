import nodemailer, { type Transporter } from "nodemailer";

let transporter: Transporter | null = null;
let consoleMode = false;

function getTransporter(): Transporter | null {
  if (transporter) return transporter;
  if (consoleMode) return null;

  const host = process.env.SMTP_HOST;
  if (!host) {
    // No SMTP configured — fall back to console logging so dev/QA can still
    // exercise the password-reset flow without provisioning email.
    consoleMode = true;
    return null;
  }

  transporter = nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === "true",
    auth:
      process.env.SMTP_USER && process.env.SMTP_PASS
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
  });
  return transporter;
}

export async function sendPasswordResetEmail(
  toEmail: string,
  resetUrl: string,
): Promise<void> {
  const t = getTransporter();
  const from =
    process.env.SMTP_FROM ?? "HK ENV. <no-reply@hkenv.local>";
  const subject = "Reset your HK ENV. password";
  const text =
    `Someone requested a password reset for this account.\n\n` +
    `If it was you, follow this link to choose a new password:\n${resetUrl}\n\n` +
    `The link expires in 30 minutes. If you did not request this, ignore this email.`;
  const html =
    `<p>Someone requested a password reset for this account.</p>` +
    `<p>If it was you, follow this link to choose a new password:</p>` +
    `<p><a href="${resetUrl}">${resetUrl}</a></p>` +
    `<p>The link expires in 30 minutes. If you did not request this, ignore this email.</p>`;

  if (!t) {
    // eslint-disable-next-line no-console
    console.log(
      `\n[email:console] To: ${toEmail}\n[email:console] Subject: ${subject}\n[email:console] Link: ${resetUrl}\n`,
    );
    return;
  }

  await t.sendMail({ from, to: toEmail, subject, text, html });
}
