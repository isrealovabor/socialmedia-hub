import assert from "node:assert/strict";
import {
  PASSWORD_POLICY_MESSAGE as backendMessage,
  passwordMeetsPolicy as backendPolicy,
} from "../src/utils/passwordPolicy.js";
import { registerSchema, resetPasswordSchema } from "../src/validators/auth.validators.js";
import {
  PASSWORD_POLICY_MESSAGE as frontendMessage,
  passwordMeetsPolicy as frontendPolicy,
} from "../../client/src/utils/passwordPolicy.js";

const cases = [
  ["Password1!", true, "complete password"],
  ["password1!", false, "missing uppercase"],
  ["PASSWORD1!", false, "missing lowercase"],
  ["Password!", false, "missing number"],
  ["Password1", false, "missing special character"],
  ["Pass1!", true, "six-character complete password"],
  ["Pa1!", false, "shorter than six characters"],
];

assert.equal(frontendMessage, backendMessage, "Frontend and backend policy messages must match.");

for (const [password, expected, description] of cases) {
  assert.equal(backendPolicy(password), expected, `Backend policy mismatch: ${description}.`);
  assert.equal(frontendPolicy(password), expected, `Frontend policy mismatch: ${description}.`);

  const registration = registerSchema.safeParse({ email: "policy-test@example.com", password });
  assert.equal(registration.success, expected, `Registration schema mismatch: ${description}.`);
  if (!expected) assert.equal(registration.error.issues[0].message, backendMessage);

  const reset = resetPasswordSchema.safeParse({
    resetToken: "valid-reset-token-for-policy-test",
    password,
    confirmPassword: password,
  });
  assert.equal(reset.success, expected, `Reset schema mismatch: ${description}.`);
  if (!expected) assert.equal(reset.error.issues[0].message, backendMessage);
}

console.log("Password policy verification passed.");
