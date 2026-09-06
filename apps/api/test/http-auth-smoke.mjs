import assert from "node:assert/strict";

const baseUrl = process.env.AUTH_E2E_BASE_URL ?? "http://localhost:3001/api/v1";
const email = process.env.AUTH_E2E_EMAIL;
const password = process.env.AUTH_E2E_PASSWORD;
const trustedOrigin = process.env.AUTH_E2E_ORIGIN ?? "http://localhost:3000";

if (!email || !password) {
  throw new Error("AUTH_E2E_EMAIL and AUTH_E2E_PASSWORD are required");
}

async function call(path, expectedStatus, init = {}) {
  const response = await fetch(`${baseUrl}${path}`, init);
  assert.equal(response.status, expectedStatus, `${init.method ?? "GET"} ${path}`);
  return response;
}

await call("/auth/session", 401);
await call("/auth/login", 403, {
  method: "POST",
  headers: { "content-type": "application/json", origin: "https://untrusted.example" },
  body: JSON.stringify({ email, password })
});

const loginResponse = await call("/auth/login", 200, {
  method: "POST",
  headers: { "content-type": "application/json", origin: trustedOrigin },
  body: JSON.stringify({ email, password })
});
const loginBody = await loginResponse.json();
assert.equal(loginBody.user.email, email.toLowerCase());
assert.equal(typeof loginBody.csrfToken, "string");
const setCookie = loginResponse.headers.getSetCookie()[0];
assert.match(setCookie, /sf_attendant_session=.*HttpOnly.*SameSite=Strict/i);
const attendantCookie = setCookie.split(";", 1)[0];

await call("/auth/session", 200, { headers: { cookie: attendantCookie } });
await call("/auth/logout", 403, {
  method: "POST",
  headers: { cookie: attendantCookie, origin: trustedOrigin }
});
await call("/auth/logout", 204, {
  method: "POST",
  headers: {
    cookie: attendantCookie,
    origin: trustedOrigin,
    "x-csrf-token": loginBody.csrfToken
  }
});
await call("/auth/session", 401, { headers: { cookie: attendantCookie } });

const anonymousResponse = await call("/anonymous-sessions", 201, {
  method: "POST",
  headers: { origin: trustedOrigin }
});
const anonymousBody = await anonymousResponse.json();
assert.equal(typeof anonymousBody.conversationId, "string");
const anonymousSetCookie = anonymousResponse.headers.getSetCookie()[0];
assert.match(anonymousSetCookie, /sf_anonymous_session=.*HttpOnly.*SameSite=Strict/i);
const anonymousCookie = anonymousSetCookie.split(";", 1)[0];
const currentAnonymous = await call("/anonymous-sessions/current", 200, {
  headers: { cookie: anonymousCookie }
});
assert.equal((await currentAnonymous.json()).conversationId, anonymousBody.conversationId);

console.log("Authentication HTTP smoke test passed");
