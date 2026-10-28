import { PrismaService } from '../../src/prisma/prisma.service.js';

export async function resetDatabase(prisma: PrismaService) {
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
        SELECT tablename FROM pg_tables
        WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'
    `;

  const names = tables.map((t) => `"${t.tablename}"`);
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${names.join(', ')} RESTART IDENTITY CASCADE`);
}
