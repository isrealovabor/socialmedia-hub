import assert from "node:assert/strict";
import bcrypt from "bcryptjs";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
if (!testDatabaseUrl || !/^postgres(ql)?:\/\//.test(testDatabaseUrl)) {
  throw new Error("TEST_DATABASE_URL must be a real isolated PostgreSQL URL, not a placeholder.");
}

process.env.DATABASE_URL = testDatabaseUrl;
process.env.DIRECT_URL = process.env.TEST_DIRECT_URL || testDatabaseUrl;
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "email-auth-test-jwt-secret-with-at-least-32-characters";
process.env.AUTH_CODE_SECRET = "email-auth-test-code-secret-with-at-least-32-characters";
process.env.CLIENT_URL = "http://127.0.0.1:5173";

const { default: app } = await import("../index.js");
const { prisma } = await import("../src/prisma.js");
const { setEmailSenderForTests } = await import("../src/utils/email.js");

const marker = `email-auth-test-${Date.now()}`;
const email = `${marker}@example.com`;
const expiredEmail = `${marker}-expired@example.com`;
const attemptLimitedEmail = `${marker}-attempts@example.com`;
const unverifiedEmail = `${marker}-unverified@example.com`;
const originalPassword = "Original1!Secure";
const newPassword = "Replacement2!Secure";
const capturedEmails = [];
let server;

setEmailSenderForTests(async (message) => {
  capturedEmails.push(message);
  return { sent: true };
});

try {
  server = app.listen(0);
  await new Promise((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });
  const baseUrl = `http://127.0.0.1:${server.address().port}/api`;

  const registration = await request(baseUrl, "/auth/register", { email: email.toUpperCase(), password: originalPassword });
  assert.equal(registration.status, 202);
  assertNoSecrets(registration.data);
  assert.equal(await prisma.user.count({ where: { email } }), 0, "Registration must not create an active user.");
  const pending = await prisma.pendingRegistration.findUnique({ where: { email } });
  const firstVerificationCode = latestCode("verifyEmail", email);
  assert.ok(pending);
  assert.notEqual(pending.codeHash, firstVerificationCode);

  const pendingLogin = await request(baseUrl, "/auth/login", { email, password: originalPassword });
  assert.equal(pendingLogin.status, 401);

  const wrongVerification = await request(baseUrl, "/auth/verify-email", { email, code: wrongCode(firstVerificationCode) });
  assert.equal(wrongVerification.status, 400);

  await prisma.pendingRegistration.update({ where: { email }, data: { lastSentAt: new Date(Date.now() - 61_000) } });
  const resend = await request(baseUrl, "/auth/resend-verification", { email });
  assert.equal(resend.status, 202);
  const secondVerificationCode = latestCode("verifyEmail", email);
  assert.notEqual(secondVerificationCode, firstVerificationCode);
  assert.equal((await request(baseUrl, "/auth/verify-email", { email, code: firstVerificationCode })).status, 400);

  const verified = await request(baseUrl, "/auth/verify-email", { email, code: secondVerificationCode });
  assert.equal(verified.status, 201);
  assert.ok(verified.data.token);
  assertNoSecrets(verified.data);
  const originalSession = verified.data.token;
  assert.equal((await request(baseUrl, "/auth/verify-email", { email, code: secondVerificationCode })).status, 400);

  const createdUser = await prisma.user.findUnique({ where: { email } });
  assert.equal(createdUser.emailVerified, true);
  assert.ok(createdUser.emailVerifiedAt);

  await request(baseUrl, "/auth/register", { email: expiredEmail, password: originalPassword });
  const expiredCode = latestCode("verifyEmail", expiredEmail);
  await prisma.pendingRegistration.update({ where: { email: expiredEmail }, data: { expiresAt: new Date(Date.now() - 1_000) } });
  assert.equal((await request(baseUrl, "/auth/verify-email", { email: expiredEmail, code: expiredCode })).status, 400);

  await request(baseUrl, "/auth/register", { email: attemptLimitedEmail, password: originalPassword });
  const attemptLimitedCode = latestCode("verifyEmail", attemptLimitedEmail);
  for (let index = 0; index < 5; index += 1) {
    assert.equal((await request(baseUrl, "/auth/verify-email", { email: attemptLimitedEmail, code: wrongCode(attemptLimitedCode) })).status, 400);
  }
  assert.equal((await request(baseUrl, "/auth/verify-email", { email: attemptLimitedEmail, code: attemptLimitedCode })).status, 400);

  await prisma.user.create({
    data: {
      email: unverifiedEmail,
      passwordHash: await bcrypt.hash(originalPassword, 12),
      emailVerified: false,
    },
  });
  const unverifiedLogin = await request(baseUrl, "/auth/login", { email: unverifiedEmail, password: originalPassword });
  assert.equal(unverifiedLogin.status, 403);
  assert.match(unverifiedLogin.data.message, /verification is required/i);

  const forgotExisting = await request(baseUrl, "/auth/forgot-password", { email });
  const forgotMissing = await request(baseUrl, "/auth/forgot-password", { email: `${marker}-missing@example.com` });
  assert.equal(forgotExisting.status, 200);
  assert.equal(forgotMissing.status, 200);
  assert.equal(forgotExisting.data.message, forgotMissing.data.message);
  assertNoSecrets(forgotExisting.data);
  const firstResetCode = latestCode("passwordResetCode", email);
  assert.equal((await request(baseUrl, "/auth/verify-reset-code", { email, code: wrongCode(firstResetCode) })).status, 400);

  const firstResetToken = await prisma.passwordResetToken.findFirst({ where: { userId: createdUser.id, usedAt: null }, orderBy: { createdAt: "desc" } });
  await prisma.passwordResetToken.update({ where: { id: firstResetToken.id }, data: { expiresAt: new Date(Date.now() - 1_000), lastSentAt: new Date(Date.now() - 61_000) } });
  assert.equal((await request(baseUrl, "/auth/verify-reset-code", { email, code: firstResetCode })).status, 400);

  await request(baseUrl, "/auth/forgot-password", { email });
  const secondResetCode = latestCode("passwordResetCode", email);
  assert.notEqual(secondResetCode, firstResetCode);
  assert.equal((await request(baseUrl, "/auth/verify-reset-code", { email, code: firstResetCode })).status, 400);
  const resetVerification = await request(baseUrl, "/auth/verify-reset-code", { email, code: secondResetCode });
  assert.equal(resetVerification.status, 200);
  assert.ok(resetVerification.data.resetToken);
  assertNoSecrets(resetVerification.data, [resetVerification.data.resetToken]);

  const reset = await request(baseUrl, "/auth/reset-password", {
    resetToken: resetVerification.data.resetToken,
    password: newPassword,
    confirmPassword: newPassword,
  });
  assert.equal(reset.status, 200);
  assert.equal((await request(baseUrl, "/auth/reset-password", {
    resetToken: resetVerification.data.resetToken,
    password: "Another3!Secure",
    confirmPassword: "Another3!Secure",
  })).status, 400);

  assert.equal((await request(baseUrl, "/auth/login", { email, password: originalPassword })).status, 401);
  const newLogin = await request(baseUrl, "/auth/login", { email, password: newPassword });
  assert.equal(newLogin.status, 200);
  assert.equal((await getRequest(baseUrl, "/auth/me", originalSession)).status, 401);
  assert.equal((await getRequest(baseUrl, "/auth/me", newLogin.data.token)).status, 200);

  await prisma.user.update({
    where: { id: createdUser.id },
    data: { accountStatus: "SUSPENDED", sessionVersion: { increment: 1 } },
  });
  assert.equal((await getRequest(baseUrl, "/auth/me", newLogin.data.token)).status, 401);
  assert.equal((await request(baseUrl, "/auth/login", { email, password: newPassword })).status, 403);
  await prisma.user.update({ where: { id: createdUser.id }, data: { accountStatus: "ACTIVE" } });

  let rateLimited = false;
  for (let index = 0; index < 10; index += 1) {
    const response = await request(baseUrl, "/auth/register", { email, password: originalPassword });
    if (response.status === 429) {
      rateLimited = true;
      break;
    }
  }
  assert.equal(rateLimited, true);

  console.log("Email verification and password reset verification passed.");
} finally {
  if (server) await new Promise((resolve) => server.close(resolve));
  await prisma.pendingRegistration.deleteMany({ where: { email: { startsWith: marker } } }).catch(() => {});
  await prisma.user.deleteMany({ where: { email: { startsWith: marker } } }).catch(() => {});
  const testSchema = new URL(testDatabaseUrl).searchParams.get("schema");
  if (process.env.TEST_DROP_SCHEMA === "true") {
    if (!testSchema?.startsWith("codex_email_auth_test_")) {
      throw new Error("Refusing to drop a test schema without the codex_email_auth_test_ prefix.");
    }
    await prisma.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${testSchema}" CASCADE`);
  }
  await prisma.$disconnect();
}

function latestCode(templateName, recipient) {
  const message = [...capturedEmails].reverse().find((entry) => entry.templateName === templateName && entry.to === recipient);
  assert.ok(message, `Expected ${templateName} email for test recipient.`);
  return message.params.code;
}

function wrongCode(actual) {
  return actual === "000000" ? "111111" : "000000";
}

function assertNoSecrets(data, allowedValues = []) {
  const serialized = JSON.stringify(data);
  for (const message of capturedEmails) {
    const code = message.params.code;
    if (code && !allowedValues.includes(code)) assert.equal(serialized.includes(code), false, "API response exposed a verification code.");
  }
}

async function request(baseUrl, path, body) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: response.status, data: await response.json().catch(() => ({})) };
}

async function getRequest(baseUrl, path, token) {
  const response = await fetch(`${baseUrl}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  return { status: response.status, data: await response.json().catch(() => ({})) };
}
