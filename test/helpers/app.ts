import { Test } from "@nestjs/testing";
import { AppModule } from "../../src/app.module.js";
import { INestApplication } from "@nestjs/common";
import { configureApp } from "../../src/config/app.config.js";
import { PrismaService } from "../../src/prisma/prisma.service.js";
import { JwtService } from "@nestjs/jwt";

export async function createTestApp() {
    const moduleRef = await Test.createTestingModule({
        imports: [AppModule]
    }).compile();

    const app: INestApplication = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();

    return {
        app,
        prisma: app.get(PrismaService),
        jwt: app.get(JwtService),
    }
}