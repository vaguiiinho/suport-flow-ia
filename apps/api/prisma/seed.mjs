import { PrismaClient } from "@prisma/client";
import { createHmac, randomBytes, scrypt as scryptCallback } from "node:crypto";
import { promisify } from "node:util";

const prisma = new PrismaClient();
const scrypt = promisify(scryptCallback);

function readSetting(name, fallback) {
  const value = process.env[name]?.trim();
  return value || fallback;
}

async function main() {
  const slug = readSetting("DEFAULT_ORGANIZATION_SLUG", "support-flow");
  const name = readSetting("DEFAULT_ORGANIZATION_NAME", "SupportFlow");

  const organization = await prisma.organization.upsert({
    where: { slug },
    create: { slug, name },
    update: { name, active: true }
  });

  console.log(`Default organization ready: ${organization.slug}`);

  const bootstrapEmail = process.env.BOOTSTRAP_ATTENDANT_EMAIL?.trim().toLowerCase();
  const bootstrapPassword = process.env.BOOTSTRAP_ATTENDANT_PASSWORD;

  if (!bootstrapEmail && !bootstrapPassword) {
    return;
  }

  if (!bootstrapEmail || !bootstrapPassword) {
    throw new Error("BOOTSTRAP_ATTENDANT_EMAIL and BOOTSTRAP_ATTENDANT_PASSWORD must be provided together");
  }

  if (!/^\S+@\S+\.\S+$/.test(bootstrapEmail)) {
    throw new Error("BOOTSTRAP_ATTENDANT_EMAIL must be a valid email address");
  }

  if (bootstrapPassword.length < 12 || bootstrapPassword.length > 128) {
    throw new Error("BOOTSTRAP_ATTENDANT_PASSWORD must contain between 12 and 128 characters");
  }

  const pepper = process.env.AUTH_SECURITY_PEPPER;
  if (!pepper || pepper.length < 32) {
    throw new Error("AUTH_SECURITY_PEPPER must contain at least 32 characters when bootstrapping an attendant");
  }

  const salt = randomBytes(16);
  const cost = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
  const derivedKey = await scrypt(bootstrapPassword, salt, 64, cost);
  const passwordHash = [
    "scrypt",
    cost.N,
    cost.r,
    cost.p,
    salt.toString("base64url"),
    derivedKey.toString("base64url")
  ].join("$");
  const subjectHash = createHmac("sha256", pepper).update(bootstrapEmail).digest("hex");

  const created = await prisma.$transaction(async (transaction) => {
    await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`attendant-bootstrap:${organization.id}`}))`;
    const existingUsers = await transaction.user.count({ where: { organizationId: organization.id } });
    if (existingUsers > 0) return false;

    const user = await transaction.user.create({
      data: {
        organizationId: organization.id,
        email: bootstrapEmail,
        passwordHash,
        status: "ACTIVE"
      }
    });

    await transaction.authEvent.create({
      data: {
        organizationId: organization.id,
        userId: user.id,
        type: "ATTENDANT_BOOTSTRAPPED",
        subjectHash,
        networkHash: createHmac("sha256", pepper).update("network:bootstrap").digest("hex")
      }
    });

    return true;
  });

  console.log(
    created
      ? "Initial attendant created successfully"
      : "Attendant bootstrap skipped: the organization already has a user"
  );
}

main()
  .catch((error) => {
    console.error("Failed to seed the default organization", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
