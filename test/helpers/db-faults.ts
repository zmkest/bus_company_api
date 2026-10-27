import { PrismaService } from "../../src/prisma/prisma.service.js";

const NAME = 'forced_insert_failure';

/**
 * Makes every INSERT into `table` fail inside PostgreSQL, so the failure
 * Returns a function that removes it.
 * ALWAYS call the returned function in a `finally` block.
 * fileParallelism: false
 */
export async function installInsertFailture(prisma: PrismaService, table: string) {
    await prisma.$executeRawUnsafe(`
        CREATE OR REPLACE FUNCTION ${NAME}() RETURNS trigger AS $$
        BEGIN
            RAISE EXCEPTION 'forced failure for rollback test';
        END;
        $$ LANGUAGE plpgsql
    `);

    await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS ${NAME} ON "${table}"`);
    await prisma.$executeRawUnsafe(`
        CREATE TRIGGER ${NAME} BEFORE INSERT ON "${table}"
        FOR EACH ROW EXECUTE FUNCTION ${NAME}()
    `);

    return async () => {
        await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS ${NAME} ON "${table}"`);
    };
}