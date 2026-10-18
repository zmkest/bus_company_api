import { IsEnum, IsIn, IsOptional, IsString, MaxLength } from "class-validator";
import { PaginationQueryDto } from "../../../common/dtos/pagination-query.dto.js";
import { Transform } from "class-transformer";
import { BusStatus } from "../../../generated/prisma/enums.js";

export const STATUS_HISTORY_SORT_FIELDS = ['createdAt', 'fromStatus', 'toStatus', 'changedBy' ];
export class FindBusStatusHistoryDto extends PaginationQueryDto {
    @IsOptional()
    @Transform(( { value }) => value?.trim())
    @IsString()
    @MaxLength(100)
    search?: string;
    
    @IsOptional()
    @IsIn(STATUS_HISTORY_SORT_FIELDS)
    sortBy: (typeof STATUS_HISTORY_SORT_FIELDS)[number] = 'createdAt';

    @IsOptional()
    @IsIn(['asc', 'desc'])
    order: 'asc' | 'desc' = 'desc';

    @IsOptional()
    @IsEnum(BusStatus, { message: 'Estado no válido' })
    fromStatus?: BusStatus;

    @IsOptional()
    @IsEnum(BusStatus, { message: 'Estado no válido' })
    toStatus?: BusStatus;
}