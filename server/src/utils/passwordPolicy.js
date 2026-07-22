export const PASSWORD_POLICY_MESSAGE =
  "Password must be at least 6 characters long and include at least one uppercase letter, one lowercase letter, one number, and one special character.";

export const passwordRequirements = Object.freeze({
  minimumLength: (password) => password.length >= 6,
  uppercase: (password) => /[A-Z]/.test(password),
  lowercase: (password) => /[a-z]/.test(password),
  number: (password) => /[0-9]/.test(password),
  specialCharacter: (password) => /[^A-Za-z0-9\s]/.test(password),
});

export function passwordMeetsPolicy(value) {
  if (typeof value !== "string") return false;
  return Object.values(passwordRequirements).every((requirement) => requirement(value));
}
