import * as bcrypt from 'bcrypt';
import { BusStatus, UserRole } from "../../src/generated/prisma/enums.js";
import { PrismaService } from "../../src/prisma/prisma.service.js";

let seq = 0;
let seqBus = 0;
const next = () => ++seq;
const nextBus = () => ++seqBus;

export async function createUser(
    prisma: PrismaService,
    overrides: Partial<{ email: string, role: UserRole, isActive: boolean }> = {}
) {
    const n = next();
    return prisma.user.create({
        data: {
            name: `User ${n}`,
            email: `user${n}@test.com`,
            passwordHash: await bcrypt.hash('Password123', 4),
            role: UserRole.ADMIN,
            isActive: true,
            ...overrides,
        }
    })
}

export async function createBus(
    prisma: PrismaService,
    overrrides: Partial<{ status: BusStatus }> = {}
) {
    const n = nextBus();
    return prisma.bus.create({
        data: {
            model: 'FORD',
            plate: `ABC-${n.toString().padStart(4, '0')}`,
            year: 2000 + n,
            odometerKm: 0,
            status: BusStatus.AVAILABLE,
            ...overrrides
        }
    })
}