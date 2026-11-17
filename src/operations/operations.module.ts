import { Module } from '@nestjs/common';
import { TripsModule } from './trips/trips.module.js';
import { RotationsModule } from './rotations/rotations.module.js';

@Module({
  imports: [TripsModule, RotationsModule],
})
export class OperationsModule {}
