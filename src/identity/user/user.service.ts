import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { TCreateUser, TCreateUserByAdmin } from './types/create-user.type.js';
import { Prisma, UserRole } from '../../generated/prisma/client.js';
import { UpdateUserDto } from './dto/update-user.dto.js';

@Injectable()
export class UserService {

  constructor(private prisma: PrismaService) { }

  async createByAdmin(createUser: TCreateUserByAdmin) {
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

  async create(createUser: TCreateUser) {
    const existing = await this.findByEmail(createUser.email);

    if (existing) {
      throw new ConflictException('El email ya está registrado');
    }

    try {
      const user = await this.prisma.user.create({
        data: {
          ...createUser,
          role: UserRole.PASSENGER
        },
        omit: { passwordHash: true }
      });
      return user;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('El email ya está registrado');
      }
      throw error;
    }
  }

  async update(id: number, updateUser: UpdateUserDto) {
    const exist = await this.findOne(id);
    
    if (!exist) throw new NotFoundException('El usuario no existe');

    const userUpdate = await this.prisma.user.update({
      where: { id },
      data: updateUser,
      omit: { passwordHash: true }
    });

    return userUpdate;

  }

  async updateActive(id: number, isActive: boolean) {
    const exist = await this.findOne(id);
    
    if (!exist) throw new NotFoundException('El usuario no existe');
    
    const userUpdate = await this.prisma.user.update({
      where: { id },
      data: { isActive },
      omit: { passwordHash: true }
    });

    return userUpdate;
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

  async changePassword(id: number, passwordHash: string) {
    await this.prisma.user.update({
      where: { id },
      data: { passwordHash },
      omit: { passwordHash: true }
    });
    return 'Contraseña actualizada correctamente';
  }

  async delete(id: number) {
    await this.prisma.user.delete({
      where: {id}
    });
    return 'Usuario eliminado';
  }
}
