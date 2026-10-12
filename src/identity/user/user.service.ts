import { ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { TCreateUser } from './types/create-user.type.js';
import { Prisma } from '../../generated/prisma/client.js';

@Injectable()
export class UserService {

  constructor(private prisma: PrismaService) { }

  async create(createUser: TCreateUser) {
    const existing = await this.findByEmail(createUser.email);

    if (existing) {
      throw new ConflictException('El email ya está registrado');
    }

    try {
      return await this.prisma.user.create({
        data: createUser,
        omit: { passwordHash: true }
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('El email ya está registrado');
      }
      throw error;
    }
  }

  async updateRefreshToken(id: number, refreshTokenHash: string | null) {
    return this.prisma.user.update({
      where: { id },
      data: {
        refreshTokenHash
      }
    })
  }

  async findOne(id: number) {
    return await this.prisma.user.findUnique({
      where: { id }
    });
  }

  async findByEmail(email: string) {
    return await this.prisma.user.findUnique({
      where: { email }
    });
  }

}
