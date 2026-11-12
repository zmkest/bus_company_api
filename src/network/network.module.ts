import { Module } from '@nestjs/common';
import { TerminalsModule } from './terminals/terminals.module.js';
import { CitiesModule } from './cities/cities.module.js';
import { MailService } from '../shared/services/mail.service.js';

@Module({
  imports: [TerminalsModule, CitiesModule, MailService],
})
export class NetworkModule {}
