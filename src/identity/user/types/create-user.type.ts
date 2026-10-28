import { UserRole } from '../../../generated/prisma/enums.js';

export class TCreateUser {
  email: string;
  passwordHash: string;
  name: string;
}

export class TCreateUserByAdmin {
  email: string;
  name: string;
  passwordHash: string;
  role: UserRole;
}
