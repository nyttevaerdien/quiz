import { Module } from '@nestjs/common';
import { DatabaseModule } from './database/database.module';
import { EventsModule } from './events/events.module';
import { PlayerModule } from './player/player.module';
import { AdminModule } from './admin/admin.module';

@Module({
  imports: [
    DatabaseModule,
    EventsModule,
    PlayerModule,
    AdminModule,
  ],
})
export class AppModule {}
