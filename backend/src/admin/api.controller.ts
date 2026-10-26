import { Controller, Get, Post, Body } from '@nestjs/common';
import { AdminService } from './admin.service';
import { ToggleCorrectDto } from './admin.controller';

@Controller('api')
export class ApiCompatibilityController {
  constructor(private readonly adminService: AdminService) {}

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
