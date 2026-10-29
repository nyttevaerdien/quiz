import { Global, Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { ApiCompatibilityController } from './api.controller';
import { AdminService } from './admin.service';

@Global()
@Module({
  controllers: [AdminController, ApiCompatibilityController],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}
