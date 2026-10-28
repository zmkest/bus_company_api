import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { TCreateUser, TCreateUserByAdmin } from './types/create-user.type.js';
import { Prisma, UserRole } from '../../generated/prisma/client.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import { FindUsersQueryDto } from './dto/find-users-query.dto.js';
import { paginate } from '../../common/interfaces/paginated.js';

const userSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  isActive: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

@Injectable()
export class UserService {
  constructor(private prisma: PrismaService) {}

  async createByAdmin(createUser: TCreateUserByAdmin) {
    const existing = await this.findByEmail(createUser.email);

    if (existing) {
      throw new ConflictException('El email ya está registrado');
    }

    try {
      return await this.prisma.user.create({
        data: createUser,
        omit: { passwordHash: true },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('El email ya está registrado');
      }
      throw error;
    }
  }

  async create(createUser: TCreateUser) {
    const { email, name, passwordHash } = createUser;
    const existing = await this.findByEmail(createUser.email);

    if (existing) {
      throw new ConflictException('El email ya está registrado');
    }

    try {
      const user = await this.prisma.user.create({
        data: {
          email,
          name,
          passwordHash,
          role: UserRole.PASSENGER,
        },
        omit: { passwordHash: true },
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
    await this.findOne(id);

    const userUpdate = await this.prisma.user.update({
      where: { id },
      data: updateUser,
      select: userSelect,
    });

    return userUpdate;
  }

  async updateActive(id: number, isActive: boolean) {
    await this.findOne(id);

    const userUpdate = await this.prisma.user.update({
      where: { id },
      data: { isActive },
      select: userSelect,
    });

    return userUpdate;
  }

  async updateRefreshToken(id: number, refreshTokenHash: string | null) {
    return this.prisma.user.update({
      where: { id },
      data: {
        refreshTokenHash,
      },
    });
  }

  async findOne(id: number) {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) throw new NotFoundException('El usuario no existe');
    return user;
  }

  async findByEmail(email: string) {
    return await this.prisma.user.findUnique({
      where: { email },
    });
  }

  async changePassword(id: number, passwordHash: string) {
    await this.prisma.user.update({
      where: { id },
      data: { passwordHash },
      omit: { passwordHash: true },
    });
    return 'Contraseña actualizada correctamente';
  }

  async delete(id: number) {
    return await this.prisma.user.delete({
      where: { id },
      select: userSelect,
    });
  }

  async count() {
    return await this.prisma.user.count();
  }

  async countIsActive(isActive: boolean) {
    return await this.prisma.user.count({
      where: { isActive },
    });
  }

  async findAll(query: FindUsersQueryDto) {
    const { limit, order, page, sortBy, search } = query;

    const where: Prisma.UserWhereInput = {
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        select: userSelect,
        orderBy: [{ [sortBy]: order }, { id: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.user.count({ where }),
    ]);

    return paginate(items, total, page, limit);
  }

  async findActiveById(id: number) {
    return this.prisma.user.findFirst({
      where: { id, isActive: true },
      select: { id: true, role: true },
    });
  }
}
