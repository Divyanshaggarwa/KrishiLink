/* Pure helpers — NOT a server action file.
   Used by both signup and login actions. */

export function normalizeIndianPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  return digits.startsWith("91") && digits.length === 12
    ? digits.slice(2)
    : digits;
}

export function isValidIndianPhone(raw: string): boolean {
  return /^[6-9]\d{9}$/.test(normalizeIndianPhone(raw));
}

export function looksLikeEmail(v: string): boolean {
  return /^\S+@\S+\.\S+$/.test(v);
}