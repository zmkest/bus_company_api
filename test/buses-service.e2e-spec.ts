import request from 'supertest';
import { INestApplication } from "@nestjs/common"
import { PrismaService } from "../src/prisma/prisma.service.js";
import { JwtService } from "@nestjs/jwt";
import { createTestApp } from "./helpers/app.js";
import { resetDatabase } from "./helpers/db.js";
import { createBus, createUser } from "./helpers/factories.js";
import { authHeader } from "./helpers/auth.js";
import { BusStatus, MaintenanceType, UserRole } from "../src/generated/prisma/enums.js";
import { installInsertFailture } from './helpers/db-faults.js';

const validPayload = () => ({
    status: BusStatus.MAINTENANCE,
    type: MaintenanceType.PREVENTIVE,
    reason: 'Inspección para revision',
    startedAt: new Date()
});

describe('PATCH /api/buses/:id/status', () => {
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
        await expectBusUnChanged(bus.id);
    });

    it('request without token', async () => {
        const bus = await createBus(prisma, { status: BusStatus.AVAILABLE });

        const res = await request(app.getHttpServer())
            .patch(`/api/buses/${bus.id}/status`)
            .send(validPayload());

        expect(res.status).toEqual(401);
        await expectBusUnChanged(bus.id);
    });

    it('token modified', async () => {
        const user = await createUser(prisma, { role: UserRole.ADMIN });
        const header = await authHeader(jwt, user);
        const bus = await createBus(prisma, { status: BusStatus.AVAILABLE });

        const token = header.Authorization.split(' ')[1];
        const [th, tp, ts] = token.split('.');
        const tokenModified = `${th}.${tp}.${ts.slice(0, 1)}nc15jdlsl`;

        const res = await request(app.getHttpServer())
            .patch(`/api/buses/${bus.id}/status`)
            .set({ Authorization: `Bearer ${tokenModified}` })
            .send(validPayload());

        expect(res.status).toEqual(401);

        await expectBusUnChanged(bus.id);
    });

    it('Rol DRIVER: forbidden request by unauthorized role', async () => {
        const user = await createUser(prisma, { role: UserRole.DRIVER });
        const header = await authHeader(jwt, user);
        const bus = await createBus(prisma, { status: BusStatus.AVAILABLE });

        const res = await request(app.getHttpServer())
            .patch(`/api/buses/${bus.id}/status`)
            .set(header)
            .send(validPayload());

        expect(res.status).toEqual(403);

        await expectBusUnChanged(bus.id);
    });

    it('DRIVER + invalid payload: forbidden request', async () => {
        const user = await createUser(prisma, { role: UserRole.DRIVER });
        const header = await authHeader(jwt, user);
        const bus = await createBus(prisma, { status: BusStatus.AVAILABLE });

        const res = await request(app.getHttpServer())
            .patch(`/api/buses/${bus.id}/status`)
            .set(header)
            .send({
                ...validPayload(),
                status: 'FLYING',
            });

        expect(res.status).toEqual(403);

        await expectBusUnChanged(bus.id);
    });

    it('return 401 when the user is deactivated after the token was issued', async () => {
        const user = await createUser(prisma, { role: UserRole.ADMIN, isActive: false });
        const bus = await createBus(prisma, { status: BusStatus.AVAILABLE });
        const header = await authHeader(jwt, user);

        const res = await request(app.getHttpServer())
            .patch(`/api/buses/${bus.id}/status`)
            .set(header)
            .send(validPayload());

        expect(res.status).toEqual(401);

        await expectBusUnChanged(bus.id);
    });

    it('return 200 and one row the Bus status history with correct changedById', async () => {
        const user = await createUser(prisma, { role: UserRole.ADMIN });
        const bus = await createBus(prisma, { status: BusStatus.AVAILABLE });
        const header = await authHeader(jwt, user);

        const res = await request(app.getHttpServer())
            .patch(`/api/buses/${bus.id}/status`)
            .set(header)
            .send(validPayload());


        expect(res.status).toEqual(200);

        const busAfter = await prisma.bus.findUniqueOrThrow({ where: { id: bus.id } });
        expect(busAfter.status).toBe(BusStatus.MAINTENANCE);
        expect(await prisma.busStatusHistory.count()).toBe(1);
        const history = await prisma.busStatusHistory.findMany();
        expect(history[0]).toMatchObject({
            busId: bus.id,
            fromStatus: bus.status,
            toStatus: BusStatus.MAINTENANCE,
            changedById: user.id,
            reason: validPayload().reason
        });
        expect(await prisma.maintenance.count()).toBe(1);
    });

    it('rolls back the bus change when the history insert fails', async () => {
        const user = await createUser(prisma, { role: UserRole.ADMIN });
        const bus = await createBus(prisma, { status: BusStatus.AVAILABLE });
        const header = await authHeader(jwt, user);

        const removeFailure = await installInsertFailture(prisma, 'BusStatusHistory')
        try {
            const res = await request(app.getHttpServer())
                .patch(`/api/buses/${bus.id}/status`)
                .set(header)
                .send(validPayload());

            expect(res.status).toEqual(500);
            await expectBusUnChanged(bus.id);
        } finally {
            await removeFailure();
        }
    });

    it('Two requests with Promise.all with different bus status', async () => {
        const user = await createUser(prisma, { role: UserRole.ADMIN });
        const bus = await createBus(prisma, { status: BusStatus.AVAILABLE });
        const header = await authHeader(jwt, user);

        const send = (status: BusStatus) => 
            request(app.getHttpServer())
                .patch(`/api/buses/${bus.id}/status`)
                .set(header)
                .send({
                    ...validPayload(),
                    status
                });

        const responses = await Promise.all([
            send(BusStatus.MAINTENANCE),
            send(BusStatus.ON_ROUTE),
        ]);

        expect(responses.map((r) => r.status).sort((x, y) => x - y)).toEqual([200, 409]);
        const winner = [BusStatus.MAINTENANCE, BusStatus.ON_ROUTE][
            responses.findIndex((r) => r.status === 200)
        ];

        const busAfter = await prisma.bus.findUniqueOrThrow({ where: { id: bus.id } });
        expect(busAfter.status).toBe(winner);
        expect(await prisma.busStatusHistory.count()).toEqual(1)
    });

    async function expectBusUnChanged(busId: number) {
        const busAfter = await prisma.bus.findUniqueOrThrow({ where: { id: busId } });
        expect(busAfter.status).toBe(BusStatus.AVAILABLE);
        expect(await prisma.busStatusHistory.count()).toBe(0);
        expect(await prisma.maintenance.count()).toBe(0);
    }

});
