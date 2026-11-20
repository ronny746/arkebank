interface OtpEntry {
  otp: string;
  expiresAt: number;
}

const otpMap = new Map<string, OtpEntry>();

export function saveOtp(email: string, otp: string, ttlSeconds = 600) {
  otpMap.set(email.toLowerCase().trim(), {
    otp,
    expiresAt: Date.now() + ttlSeconds * 1000
  });
}

export function verifyOtp(email: string, inputOtp: string): boolean {
  const normalized = email.toLowerCase().trim();
  const entry = otpMap.get(normalized);
  const bypassOtp = process.env.OTP_BYPASS_CODE;

  // Intended only for explicitly configured temporary/internal deployments.
  // No bypass exists unless the production environment supplies a value.
  if (bypassOtp && inputOtp.trim() === bypassOtp) {
    return true;
  }

  if (!entry) return false;
  if (Date.now() > entry.expiresAt) {
    otpMap.delete(normalized);
    return false;
  }

  if (entry.otp === inputOtp.trim()) {
    otpMap.delete(normalized);
    return true;
  }
  return false;
}
