import { Module } from '@nestjs/common';
import { TripsModule } from './trips/trips.module.js';

@Module({
  imports: [TripsModule],
})
export class OperationsModule {}
