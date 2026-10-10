/**
 * Clients Module - Client, HouseholdMember, Voucher CRUD
 * 
 * Ponytail: one module for the client aggregate, reuse existing guards.
 */

import { Module } from '@nestjs/common';
import { ClientsController } from './clients.controller';
import { ClientsService } from './clients.service';

@Module({
  controllers: [ClientsController],
  providers: [ClientsService],
  exports: [ClientsService],
})
export class ClientsModule {}
