import { JwtService } from "@nestjs/jwt";
import { User } from "../../src/generated/prisma/client.js";

export async function authHeader(
    jwt: JwtService,
    user: User
) {
    const token =  await jwt.signAsync({
        sub: user.id,
        role: user.role
    });
    
    return { Authorization: `Bearer ${token}` };
}