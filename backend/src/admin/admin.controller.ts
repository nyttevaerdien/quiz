import { Controller, Post, Get, Body, Param, Delete } from '@nestjs/common';
import { AdminService } from './admin.service';

export class AdminLoginDto {
  password: string;
}

export class ToggleCorrectDto {
  correct_key: string;
}

@Controller('api/admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Post('login')
  login(@Body() body: AdminLoginDto) {
    return this.adminService.login(body.password);
  }

  @Get('dashboard')
  getDashboard() {
    return this.adminService.getDashboardData();
  }

  @Post('start_game')
  startGame() {
    return this.adminService.startGame();
  }

  @Post('end_game')
  endGame() {
    return this.adminService.endGame();
  }

  @Post('next_question')
  nextQuestion() {
    return this.adminService.nextQuestion();
  }

  @Post('start_grading')
  startGrading() {
    return this.adminService.startGrading();
  }

  @Post('toggle_correct')
  toggleCorrect(@Body() body: ToggleCorrectDto) {
    return this.adminService.toggleCorrect(body.correct_key);
  }

  @Delete('users/:userId')
  removeUser(@Param('userId') userId: string) {
    return this.adminService.removeUser(userId);
  }
}
