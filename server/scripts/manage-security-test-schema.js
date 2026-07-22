import "dotenv/config";
import { prisma } from "../src/prisma.js";

const [action, schemaName] = process.argv.slice(2);

if (!["create", "drop"].includes(action)) {
  throw new Error("Action must be create or drop.");
}
if (!/^codex_security_test_[0-9]+$/.test(schemaName || "")) {
  throw new Error("Refusing to manage a schema outside the security-test prefix.");
}

try {
  if (action === "create") {
    await prisma.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
    await prisma.$executeRawUnsafe(`CREATE SCHEMA "${schemaName}"`);
  } else {
    await prisma.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
  }
} finally {
  await prisma.$disconnect();
}
