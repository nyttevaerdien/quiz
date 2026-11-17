import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { AdminAuthGuard } from './admin-auth.guard';
import { Public } from './public.decorator';
import { AdminService } from './admin.service';
import { ToggleCorrectDto } from './admin.controller';

@Controller('api')
@UseGuards(AdminAuthGuard)
export class ApiCompatibilityController {
  constructor(private readonly adminService: AdminService) {}

  @Public()
  @Get('health')
  health() {
    return { status: 'healthy', service: 'quiz-backend-nest' };
  }

  @Get('refresh')
  refresh() {
    return this.adminService.getDashboardData();
  }

  @Post('toggle_correct')
  toggleCorrect(@Body() body: ToggleCorrectDto) {
    return this.adminService.toggleCorrect(body.correct_key);
  }
}
