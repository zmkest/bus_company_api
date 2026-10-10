import { EUserRole } from "../../auth/common/enums.common.js";

export class TCreateUser {
    email: string;
    passwordHash: string;
    name: string;
    role: EUserRole;
}