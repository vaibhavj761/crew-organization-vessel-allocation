import { PrismaClient } from '@prisma/client';
import { env } from '../src/config/env.js';
import { hashPassword } from '../src/utils/password.js';
const prisma = new PrismaClient();
async function main() {
    if (!env.ADMIN_SEED_EMAIL || !env.ADMIN_SEED_PASSWORD || !env.ADMIN_SEED_NAME) {
        throw new Error('ADMIN_SEED_EMAIL, ADMIN_SEED_PASSWORD, and ADMIN_SEED_NAME must be set');
    }
    const email = env.ADMIN_SEED_EMAIL.toLowerCase().trim();
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
        console.log(`Admin user already exists for ${email}`);
        return;
    }
    const passwordHash = await hashPassword(env.ADMIN_SEED_PASSWORD);
    await prisma.user.create({
        data: {
            name: env.ADMIN_SEED_NAME,
            email,
            passwordHash,
            role: 'ADMIN',
            isActive: true,
        },
    });
    console.log(`Admin user created for ${email}`);
}
main()
    .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
})
    .finally(async () => {
    await prisma.$disconnect();
});
