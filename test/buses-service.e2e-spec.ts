import request from 'supertest';
import { INestApplication } from "@nestjs/common"
import { PrismaService } from "../src/prisma/prisma.service.js";
import { JwtService } from "@nestjs/jwt";
import { createTestApp } from "./helpers/app.js";
import { resetDatabase } from "./helpers/db.js";
import { createBus, createUser } from "./helpers/factories.js";
import { authHeader } from "./helpers/auth.js";
import { BusStatus, MaintenanceType, UserRole } from "../src/generated/prisma/enums.js";

describe('PATCH /api/buses/:id/status-history', () => {
    let app: INestApplication;
    let prisma: PrismaService;
    let jwt: JwtService;

    beforeAll(async () => {
        ({ app, prisma, jwt } = await createTestApp());
    });

    beforeEach(async () => {
        await resetDatabase(prisma);
    });

    afterAll(async () => {
        await app.close();
    });

    it('returns 400 when reason is missing for MAINTENANCE', async () => {
        const user = await createUser(prisma, { role: UserRole.ADMIN });
        const bus = await createBus(prisma, { status: BusStatus.AVAILABLE });
        const headers = await authHeader(jwt, user);

        const res = await request(app.getHttpServer())
            .patch(`/api/buses/${bus.id}/status`)
            .set(headers)
            .send({
                status: BusStatus.MAINTENANCE,
                type: MaintenanceType.PREVENTIVE,
                startedAt: new Date()
            });

        expect(res.status).toBe(400);
        expect(res.body.message).toEqual(
            expect.arrayContaining([
                'La razón para este cambio de estado es requerida',
                'La razón debe ser un string',
                'La razón debe ser menor o igual a 255 caracteres'
            ])
        );

        // Bus must not change
        const busAfter = await prisma.bus.findUniqueOrThrow({ where: { id: bus.id } });
        expect(busAfter.status).toBe(BusStatus.AVAILABLE);
        expect(await prisma.busStatusHistory.count()).toBe(0);
        expect(await prisma.maintenance.count()).toBe(0);
    });

})