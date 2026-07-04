const baseUrl = process.env.API_URL || "http://127.0.0.1:4000/api";
const unique = Date.now();
const credentials = {
  name: "Israel",
  email: `test-${unique}@test.com`,
  password: "Password123!",
};

async function request(path, body) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`${path} failed (${response.status}): ${data.message || "No JSON error message"}`);
  }
  return data;
}

const register = await request("/auth/register", credentials);
if (!register.success || !register.token || register.user?.email !== credentials.email) {
  throw new Error("Register response did not include success, token, and user.");
}

const login = await request("/auth/login", {
  email: credentials.email,
  password: credentials.password,
});
if (!login.success || !login.token || login.user?.email !== credentials.email) {
  throw new Error("Login response did not include success, token, and user.");
}

console.log("Registration and login both work.");
