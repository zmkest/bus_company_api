import { IsIn, IsOptional, IsString, MaxLength } from "class-validator";
import { PaginationQueryDto } from "../../../common/dtos/pagination-query.dto.js";

export const USER_SORT_FIELDS = ['createdAt', 'name', 'email', 'role'] as const;

export class FindUsersQueryDto extends PaginationQueryDto {
    @IsOptional()
    @IsString()
    @MaxLength(100)
    search?: string;

    @IsOptional()
    @IsIn(USER_SORT_FIELDS)
    sortBy: (typeof USER_SORT_FIELDS)[number] = 'createdAt';

    @IsOptional()
    @IsIn(['asc', 'desc'])
    order: 'asc' | 'desc' = 'desc';
}