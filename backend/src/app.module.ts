import { Module } from '@nestjs/common';
import { DatabaseModule } from './database/database.module';
import { RabbitMQModule } from './rabbitmq/rabbitmq.module';
import { EventsModule } from './events/events.module';
import { PlayerModule } from './player/player.module';
import { AdminModule } from './admin/admin.module';

@Module({
  imports: [
    DatabaseModule,
    RabbitMQModule,
    EventsModule,
    PlayerModule,
    AdminModule,
  ],
})
export class AppModule {}
