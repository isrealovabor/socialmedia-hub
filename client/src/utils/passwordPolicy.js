export const PASSWORD_POLICY_MESSAGE =
  "Password must be at least 6 characters long and include at least one uppercase letter, one lowercase letter, one number, and one special character.";

export const PASSWORD_REQUIREMENTS = Object.freeze([
  { key: "minimumLength", label: "At least 6 characters", test: (password) => password.length >= 6 },
  { key: "uppercase", label: "At least one uppercase letter", test: (password) => /[A-Z]/.test(password) },
  { key: "lowercase", label: "At least one lowercase letter", test: (password) => /[a-z]/.test(password) },
  { key: "number", label: "At least one number", test: (password) => /[0-9]/.test(password) },
  { key: "specialCharacter", label: "At least one special character", test: (password) => /[^A-Za-z0-9\s]/.test(password) },
]);

export function passwordValidation(password = "") {
  return Object.fromEntries(PASSWORD_REQUIREMENTS.map((requirement) => [requirement.key, requirement.test(password)]));
}

export function passwordMeetsPolicy(password) {
  return typeof password === "string" && PASSWORD_REQUIREMENTS.every((requirement) => requirement.test(password));
}
