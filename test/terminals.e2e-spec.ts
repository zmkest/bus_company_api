import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { createTestApp } from './helpers/app.js';
import { resetDatabase } from './helpers/db.js';
import { createUser } from './helpers/factories.js';
import { authHeader } from './helpers/auth.js';
import { UserRole } from '../src/generated/prisma/enums.js';

describe('GET /api/terminals/:id', () => {
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

  const createTerminal = async () => {
    const city = await prisma.city.create({ data: { name: 'Quito' } });
    return prisma.terminal.create({
      data: { name: 'Terminal Quitumbe', cityId: city.id, address: 'Av. Cóndor Ñan' },
    });
  };

  it('returns 200 with the terminal and its city', async () => {
    const user = await createUser(prisma, { role: UserRole.ADMIN });
    const terminal = await createTerminal();

    const res = await request(app.getHttpServer())
      .get(`/api/terminals/${terminal.id}`)
      .set(await authHeader(jwt, user));

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: terminal.id,
      name: 'Terminal Quitumbe',
      address: 'Av. Cóndor Ñan',
      city: { id: terminal.cityId, name: 'Quito' },
    });
  });

  it('allows OPERATOR role', async () => {
    const user = await createUser(prisma, { role: UserRole.OPERATOR });
    const terminal = await createTerminal();

    const res = await request(app.getHttpServer())
      .get(`/api/terminals/${terminal.id}`)
      .set(await authHeader(jwt, user));

    expect(res.status).toBe(200);
  });

  it('returns 404 when the terminal does not exist', async () => {
    const user = await createUser(prisma, { role: UserRole.ADMIN });

    const res = await request(app.getHttpServer())
      .get('/api/terminals/9999')
      .set(await authHeader(jwt, user));

    expect(res.status).toBe(404);
  });

  it('returns 400 when id is not a number', async () => {
    const user = await createUser(prisma, { role: UserRole.ADMIN });

    const res = await request(app.getHttpServer())
      .get('/api/terminals/abc')
      .set(await authHeader(jwt, user));

    expect(res.status).toBe(400);
  });

  it('returns 401 without token', async () => {
    const terminal = await createTerminal();

    const res = await request(app.getHttpServer()).get(`/api/terminals/${terminal.id}`);

    expect(res.status).toBe(401);
  });

  it('returns 403 for a role without permission', async () => {
    const user = await createUser(prisma, { role: UserRole.PASSENGER });
    const terminal = await createTerminal();

    const res = await request(app.getHttpServer())
      .get(`/api/terminals/${terminal.id}`)
      .set(await authHeader(jwt, user));

    expect(res.status).toBe(403);
  });
});
