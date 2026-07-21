// src/lib/password.ts
// Central password policy for staff/admin accounts.

export const PASSWORD_MIN_LEN = 8;
export const PASSWORD_MAX_LEN = 30;

export interface PasswordCheckResult {
  valid: boolean;
  errors: string[];
}

/**
 * Strong password policy:
 *  - 8 to 30 characters
 *  - at least one uppercase letter
 *  - at least one lowercase letter
 *  - at least one digit
 *  - at least one special character
 *  - no whitespace
 */
export function checkPasswordStrength(password: string): PasswordCheckResult {
  const errors: string[] = [];

  if (typeof password !== "string" || !password) {
    return { valid: false, errors: ["Password is required"] };
  }
  if (password.length < PASSWORD_MIN_LEN) {
    errors.push(`Password must be at least ${PASSWORD_MIN_LEN} characters`);
  }
  if (password.length > PASSWORD_MAX_LEN) {
    errors.push(`Password must be at most ${PASSWORD_MAX_LEN} characters`);
  }
  if (/\s/.test(password)) {
    errors.push("Password must not contain spaces");
  }
  if (!/[a-z]/.test(password)) {
    errors.push("Password must include at least one lowercase letter");
  }
  if (!/[A-Z]/.test(password)) {
    errors.push("Password must include at least one uppercase letter");
  }
  if (!/[0-9]/.test(password)) {
    errors.push("Password must include at least one number");
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    errors.push("Password must include at least one special character (e.g. !@#$%^&*)");
  }

  return { valid: errors.length === 0, errors };
}
