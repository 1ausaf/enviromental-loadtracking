import { generateSecret, generateURI, verifySync } from "otplib";
import QRCode from "qrcode";

// Standard authenticator-app preset: 6 digits, 30-second period, SHA-1.
// epochTolerance=1 forgives ±1 step (≈30s) of clock skew between the
// server and the user's phone.

const ISSUER = "HK ENV.";

export function generateTotpSecret(): string {
  return generateSecret({ length: 20 });
}

export function buildOtpAuthUrl(secret: string, accountEmail: string): string {
  return generateURI({
    issuer: ISSUER,
    label: accountEmail,
    secret,
    algorithm: "sha1",
    digits: 6,
    period: 30,
  });
}

export function buildQrDataUrl(otpAuthUrl: string): Promise<string> {
  return QRCode.toDataURL(otpAuthUrl, { margin: 1, width: 256 });
}

export function verifyTotp(code: string, secret: string): boolean {
  const result = verifySync({
    token: code.trim(),
    secret,
    algorithm: "sha1",
    digits: 6,
    period: 30,
    epochTolerance: 1,
  });
  return result.valid;
}
