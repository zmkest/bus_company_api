import { Injectable } from '@nestjs/common';
import { CreateAuthDto } from './dto/create-auth.dto.js';
import { UpdateAuthDto } from './dto/update-auth.dto.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { UserService } from '../user/user.service.js';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {

  constructor(
    private readonly prisma: PrismaService,
    private readonly user: UserService
  ) {}

  async create(createAuthDto: CreateAuthDto) {
    const { passwordHash: password, ...data} =  createAuthDto;

    const hash = await bcrypt.hash(password, 10);
    
    const user = await this.user.create({ 
      ...data, 
      passwordHash: hash 
    });

    return user;
  }

  findAll() {
    return `This action returns all auth`;
  }

  findOne(id: number) {
    return `This action returns a #${id} auth`;
  }

  update(id: number, updateAuthDto: UpdateAuthDto) {
    return `This action updates a #${id} auth`;
  }

  remove(id: number) {
    return `This action removes a #${id} auth`;
  }
}
