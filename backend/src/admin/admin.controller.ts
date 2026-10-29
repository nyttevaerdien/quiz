import { Controller, Post, Get, Body, Param, Delete } from '@nestjs/common';
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
