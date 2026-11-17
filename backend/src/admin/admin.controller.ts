import { Controller, Post, Get, Body, Param, Delete, UseGuards, Req } from '@nestjs/common';
import { AdminAuthGuard } from './admin-auth.guard';
import { Public } from './public.decorator';
import { AdminService } from './admin.service';

export class AdminLoginDto {
  password: string;
}

export class ToggleCorrectDto {
  correct_key: string;
}

export class SetAnswerKeyDto {
  questionNumber: number;
  correctAnswer: string;
}

@Controller('api/admin')
@UseGuards(AdminAuthGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Public()
  @Post('login')
  login(@Body() body: AdminLoginDto, @Req() req: any) {
    const clientIp: string = req.ip || req.headers['x-forwarded-for'] || 'unknown';
    return this.adminService.login(body.password, clientIp);
  }

  @Post('logout')
  logout(@Req() req: any) {
    const header: string = req.headers['authorization'] || '';
    const token = header.startsWith('Bearer ') ? header.slice('Bearer '.length).trim() : '';
    this.adminService.logout(token);
    return { success: true };
  }

  @Get('dashboard')
  getDashboard() {
    return this.adminService.getDashboardData();
  }

  @Get('answer_keys')
  getAnswerKeys() {
    return this.adminService.getAnswerKeys();
  }

  @Post('answer_keys')
  setAnswerKey(@Body() body: SetAnswerKeyDto) {
    return this.adminService.setAnswerKey(body.questionNumber, body.correctAnswer);
  }

  @Delete('answer_keys/:questionNumber')
  deleteAnswerKey(@Param('questionNumber') questionNumber: string) {
    return this.adminService.deleteAnswerKey(parseInt(questionNumber, 10));
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
