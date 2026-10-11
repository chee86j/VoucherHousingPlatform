import { Module } from '@nestjs/common';
import { FollowUpTasksController, ShowingsController } from './showings.controller';
import { ShowingsService } from './showings.service';

@Module({ controllers: [ShowingsController, FollowUpTasksController], providers: [ShowingsService] })
export class ShowingsModule {}
