import { Global, Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { ApiCompatibilityController } from './api.controller';
import { AdminService } from './admin.service';
import { AdminAuthGuard } from './admin-auth.guard';

@Global()
@Module({
  controllers: [AdminController, ApiCompatibilityController],
  providers: [AdminService, AdminAuthGuard],
  exports: [AdminService],
})
export class AdminModule {}
