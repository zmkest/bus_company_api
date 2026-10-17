import { IsIn, IsOptional, IsString, MaxLength } from "class-validator";
import { PaginationQueryDto } from "../../../common/dtos/pagination-query.dto.js";
import { Transform } from "class-transformer";

export const STATUS_HISTORY_SORT_FIELDS = ['createdAt', 'fromStatus', 'reason', 'changedBy' ]
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
}