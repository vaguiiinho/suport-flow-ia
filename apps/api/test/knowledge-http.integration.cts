import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/infrastructure/prisma/prisma.service";
import { CryptoPasswordHasher } from "../src/modules/auth/infrastructure/crypto-password-hasher";

const trustedOrigin = "http://localhost:3000";

function pdfWithText(text: string): Buffer {
  const stream = `BT /F1 12 Tf 72 100 Td (${text}) Tj ET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 200] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`
  ];
  let document = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(document));
    document += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = Buffer.byteLength(document);
  document += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  document += offsets
    .slice(1)
    .map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`)
    .join("");
  document += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(document);
}

test("knowledge HTTP contract enforces authentication, CSRF, organization scope and PDF limits", async (context) => {
  const suffix = randomUUID();
  const storageRoot = await mkdtemp(join(tmpdir(), "support-flow-http-storage-"));
  process.env.DEFAULT_ORGANIZATION_SLUG = `knowledge-http-a-${suffix}`;
  process.env.AUTH_SECURITY_PEPPER = "integration-http-pepper-with-at-least-thirty-two-characters";
  process.env.WEB_ORIGIN = trustedOrigin;
  process.env.COOKIE_SECURE = "false";
  process.env.FILE_STORAGE_ROOT = storageRoot;
  process.env.PDF_MAX_BYTES = "1024";
  process.env.PDF_MAX_PAGES = "5";

  const prisma = new PrismaService();
  await prisma.$connect();
  const organizationA = await prisma.organization.create({
    data: { name: "Knowledge HTTP A", slug: process.env.DEFAULT_ORGANIZATION_SLUG }
  });
  const organizationB = await prisma.organization.create({
    data: { name: "Knowledge HTTP B", slug: `knowledge-http-b-${suffix}` }
  });
  const email = `attendant-${suffix}@example.com`;
  const password = "phase-three-password";
  await prisma.user.create({
    data: {
      organizationId: organizationA.id,
      email,
      passwordHash: await new CryptoPasswordHasher().hash(password)
    }
  });
  const foreignSource = await prisma.knowledgeSource.create({
    data: {
      familyId: randomUUID(),
      organizationId: organizationB.id,
      type: "ARTICLE",
      visibility: "INTERNAL",
      title: "Foreign article",
      content: "Must remain private",
      contentHash: "foreign-http-hash",
      version: 1
    }
  });

  const app = await NestFactory.create(AppModule, { logger: false, abortOnError: false });
  app.setGlobalPrefix("api/v1");
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
  await app.listen(0, "127.0.0.1");
  const baseUrl = await app.getUrl();

  context.after(async () => {
    await app.close();
    await prisma.authEvent.deleteMany({ where: { organizationId: organizationA.id } });
    await prisma.attendantSession.deleteMany({ where: { organizationId: organizationA.id } });
    await prisma.knowledgeSource.deleteMany({
      where: { organizationId: { in: [organizationA.id, organizationB.id] } }
    });
    await prisma.user.deleteMany({ where: { organizationId: organizationA.id } });
    await prisma.organization.deleteMany({ where: { id: { in: [organizationA.id, organizationB.id] } } });
    await prisma.$disconnect();
    await rm(storageRoot, { recursive: true, force: true });
  });

  const unauthenticated = await fetch(`${baseUrl}/api/v1/knowledge/articles`);
  assert.equal(unauthenticated.status, 401);

  const unauthenticatedUploadForm = new FormData();
  unauthenticatedUploadForm.set("title", "Unauthenticated PDF");
  unauthenticatedUploadForm.set("visibility", "PUBLIC");
  unauthenticatedUploadForm.set(
    "file",
    new Blob(["x".repeat(2048)], { type: "application/pdf" }),
    "large.pdf"
  );
  const unauthenticatedUpload = await fetch(`${baseUrl}/api/v1/knowledge/pdfs`, {
    method: "POST",
    body: unauthenticatedUploadForm
  });
  assert.equal(unauthenticatedUpload.status, 401);

  const login = await fetch(`${baseUrl}/api/v1/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: trustedOrigin },
    body: JSON.stringify({ email, password })
  });
  assert.equal(login.status, 200);
  const loginBody = (await login.json()) as { csrfToken: string };
  const setCookie = login.headers.get("set-cookie");
  assert.ok(setCookie);
  const cookie = setCookie.split(";", 1)[0]!;

  const authenticatedGet = await fetch(`${baseUrl}/api/v1/knowledge/articles`, {
    headers: { cookie }
  });
  assert.equal(authenticatedGet.status, 200);

  const articleBody = { title: "Reset password", content: "Use the recovery link.", visibility: "PUBLIC" };
  const missingCsrf = await fetch(`${baseUrl}/api/v1/knowledge/articles`, {
    method: "POST",
    headers: { cookie, "content-type": "application/json", origin: trustedOrigin },
    body: JSON.stringify(articleBody)
  });
  assert.equal(missingCsrf.status, 403);

  const untrustedOrigin = await fetch(`${baseUrl}/api/v1/knowledge/articles`, {
    method: "POST",
    headers: {
      cookie,
      "content-type": "application/json",
      origin: "https://attacker.example",
      "x-csrf-token": loginBody.csrfToken
    },
    body: JSON.stringify(articleBody)
  });
  assert.equal(untrustedOrigin.status, 403);

  const clientOrganization = await fetch(`${baseUrl}/api/v1/knowledge/articles`, {
    method: "POST",
    headers: {
      cookie,
      "content-type": "application/json",
      origin: trustedOrigin,
      "x-csrf-token": loginBody.csrfToken
    },
    body: JSON.stringify({ ...articleBody, organizationId: organizationB.id })
  });
  assert.equal(clientOrganization.status, 400);

  const createdResponse = await fetch(`${baseUrl}/api/v1/knowledge/articles`, {
    method: "POST",
    headers: {
      cookie,
      "content-type": "application/json",
      origin: trustedOrigin,
      "x-csrf-token": loginBody.csrfToken
    },
    body: JSON.stringify(articleBody)
  });
  assert.equal(createdResponse.status, 201);
  const created = (await createdResponse.json()) as Record<string, unknown> & { id: string };
  assert.equal(created.content, articleBody.content);
  assert.equal("contentHash" in created, false);
  assert.equal("storageKey" in created, false);

  const article = await fetch(`${baseUrl}/api/v1/knowledge/articles/${created.id}`, {
    headers: { cookie }
  });
  assert.equal(article.status, 200);

  const foreignUpdate = await fetch(`${baseUrl}/api/v1/knowledge/articles/${foreignSource.familyId}`, {
    method: "PATCH",
    headers: {
      cookie,
      "content-type": "application/json",
      origin: trustedOrigin,
      "x-csrf-token": loginBody.csrfToken
    },
    body: JSON.stringify({ title: "Attempted overwrite" })
  });
  assert.equal(foreignUpdate.status, 404);
  assert.equal(
    (await prisma.knowledgeSource.findUniqueOrThrow({ where: { id: foreignSource.id } })).title,
    "Foreign article"
  );

  const invalidPdfForm = new FormData();
  invalidPdfForm.set("title", "Invalid PDF");
  invalidPdfForm.set("visibility", "PUBLIC");
  invalidPdfForm.set("file", new Blob(["not a pdf"], { type: "application/pdf" }), "ignored-name.pdf");
  const invalidPdf = await fetch(`${baseUrl}/api/v1/knowledge/pdfs`, {
    method: "POST",
    headers: { cookie, origin: trustedOrigin, "x-csrf-token": loginBody.csrfToken },
    body: invalidPdfForm
  });
  assert.equal(invalidPdf.status, 422);
  assert.equal(((await invalidPdf.json()) as { code: string }).code, "PDF_SIGNATURE_INVALID");

  const oversizedForm = new FormData();
  oversizedForm.set("title", "Oversized PDF");
  oversizedForm.set("visibility", "PUBLIC");
  oversizedForm.set("file", new Blob(["x".repeat(2048)], { type: "application/pdf" }), "large.pdf");
  const oversizedPdf = await fetch(`${baseUrl}/api/v1/knowledge/pdfs`, {
    method: "POST",
    headers: { cookie, origin: trustedOrigin, "x-csrf-token": loginBody.csrfToken },
    body: oversizedForm
  });
  assert.equal(oversizedPdf.status, 413);
  assert.equal(((await oversizedPdf.json()) as { code: string }).code, "PDF_TOO_LARGE");

  const validPdfForm = new FormData();
  validPdfForm.set("title", "PDF guide");
  validPdfForm.set("visibility", "INTERNAL");
  validPdfForm.set(
    "file",
    new Blob([pdfWithText("Support guide").toString("utf8")], { type: "application/pdf" }),
    "unsafe/../name.pdf"
  );
  const validPdfResponse = await fetch(`${baseUrl}/api/v1/knowledge/pdfs`, {
    method: "POST",
    headers: { cookie, origin: trustedOrigin, "x-csrf-token": loginBody.csrfToken },
    body: validPdfForm
  });
  assert.equal(validPdfResponse.status, 201);
  const validPdf = (await validPdfResponse.json()) as Record<string, unknown> & { versionId: string };
  assert.equal(validPdf.type, "PDF");
  assert.equal("contentHash" in validPdf, false);
  assert.equal("storageKey" in validPdf, false);
  const storedPdf = await prisma.knowledgeSource.findUniqueOrThrow({ where: { id: validPdf.versionId } });
  assert.equal(
    storedPdf.storageKey,
    `organizations/${organizationA.id}/knowledge/${storedPdf.familyId}/versions/${storedPdf.id}.pdf`
  );

  const removed = await fetch(`${baseUrl}/api/v1/knowledge/articles/${created.id}`, {
    method: "DELETE",
    headers: { cookie, origin: trustedOrigin, "x-csrf-token": loginBody.csrfToken }
  });
  assert.equal(removed.status, 204);
});
