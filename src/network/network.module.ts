import { Module } from '@nestjs/common';
import { TerminalsModule } from './terminals/terminals.module.js';
import { MailService } from '../shared/services/mail.service.js';

@Module({
  imports: [TerminalsModule, MailService],
})
export class NetworkModule {}
