import { Module } from '@nestjs/common';
import { TerminalsModule } from './terminals/terminals.module.js';
import { CitiesModule } from './cities/cities.module.js';
import { RoutesModule } from './routes/routes.module.js';
import { MailService } from '../shared/services/mail.service.js';

@Module({
  imports: [TerminalsModule, CitiesModule, RoutesModule, MailService],
})
export class NetworkModule {}
