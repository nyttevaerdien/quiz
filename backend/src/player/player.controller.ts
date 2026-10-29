import { Controller, Post, Get, Body, Param, Query } from '@nestjs/common';
import { PlayerService } from './player.service';

export class RegisterDto {
  nickname: string;
  userId?: string;
}

export class JoinDto {
  userId: string;
}

export class AnswerDto {
  userId: string;
  answer: string;
}

@Controller('api/player')
export class PlayerController {
  constructor(private readonly playerService: PlayerService) {}

  @Post('register')
  async register(@Body() body: RegisterDto) {
    return this.playerService.register(body.nickname, body.userId);
  }

  @Get('profile/:userId')
  async getProfile(@Param('userId') userId: string) {
    return this.playerService.getProfile(userId);
  }

  @Post('join')
  async joinGame(@Body() body: JoinDto) {
    return this.playerService.joinGame(body.userId);
  }

  @Post('answer')
  async submitAnswer(@Body() body: AnswerDto) {
    return this.playerService.submitAnswer(body.userId, body.answer);
  }

  @Get('status')
  async getStatus(@Query('userId') userId?: string) {
    return this.playerService.getStatus(userId);
  }

  @Get('leaderboard')
  async getLeaderboard() {
    return this.playerService.getLeaderboard();
  }
}
