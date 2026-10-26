import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { ApiCompatibilityController } from './api.controller';
import { AdminService } from './admin.service';

@Module({
  controllers: [AdminController, ApiCompatibilityController],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}
