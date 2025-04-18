import { execSync } from 'node:child_process';

execSync(
  `npx prisma migrate diff --from-url ${process.env.DATABASE_URL} --to-schema-datamodel prisma/schema.prisma --script | npx prisma db execute --stdin`,
  { stdio: 'inherit' },
);
