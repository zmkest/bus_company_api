import { Controller, Get, Query } from '@nestjs/common';
import { CitiesService } from './cities.service.js';
import { FindCitiesQueryDto } from './dto/find-cities-query.dto.js';

@Controller('cities')
export class CitiesController {
  constructor(private readonly citiesService: CitiesService) {}

  @Get()
  findAll(@Query() query: FindCitiesQueryDto) {
    return this.citiesService.findAll(query);
  }
}
