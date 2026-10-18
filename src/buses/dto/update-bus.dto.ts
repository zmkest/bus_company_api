import { OmitType, PartialType } from '@nestjs/mapped-types';
import { CreateBusDto } from './create-bus.dto.js';

export class UpdateBusDto extends PartialType(OmitType(CreateBusDto, ['plate'] as const)) {}
