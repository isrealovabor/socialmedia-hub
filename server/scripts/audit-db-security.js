import "dotenv/config";
import { prisma } from "../src/prisma.js";

try {
  const [role] = await prisma.$queryRawUnsafe(`
    SELECT current_user AS "currentUser",
           r.rolsuper AS "isSuperuser",
           r.rolbypassrls AS "bypassesRls"
    FROM pg_roles r
    WHERE r.rolname = current_user
  `);
  const tables = await prisma.$queryRawUnsafe(`
    SELECT c.relname AS "tableName",
           c.relrowsecurity AS "rlsEnabled",
           has_table_privilege('anon', format('%I.%I', n.nspname, c.relname), 'SELECT,INSERT,UPDATE,DELETE') AS "anonHasDataAccess",
           has_table_privilege('authenticated', format('%I.%I', n.nspname, c.relname), 'SELECT,INSERT,UPDATE,DELETE') AS "authenticatedHasDataAccess",
           EXISTS (
             SELECT 1
             FROM aclexplode(COALESCE(c.relacl, acldefault('r', c.relowner))) acl
             WHERE acl.grantee = 0
               AND acl.privilege_type IN ('SELECT', 'INSERT', 'UPDATE', 'DELETE')
           ) AS "publicHasDataAccess"
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = current_schema() AND c.relkind = 'r'
    ORDER BY c.relname
  `);

  console.log(JSON.stringify({ role, tables }, null, 2));
} finally {
  await prisma.$disconnect();
}
