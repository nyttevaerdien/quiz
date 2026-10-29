import { Injectable, BadRequestException } from '@nestjs/common';
import { DatabaseService, GameState, LeaderboardEntry } from '../database/database.service';
import { RabbitMQService } from '../rabbitmq/rabbitmq.service';
import { EventsGateway } from '../events/events.gateway';
import { AdminService } from '../admin/admin.service';
import { isFuzzyAnswerMatch } from '../common/fuzzy-matcher';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class PlayerService {
  constructor(
    private readonly db: DatabaseService,
    private readonly rabbitmq: RabbitMQService,
    private readonly eventsGateway: EventsGateway,
    private readonly adminService: AdminService,
  ) {}

  async register(nickname: string, existingUserId?: string): Promise<{ userId: string; nickname: string }> {
    const cleanNick = (nickname || '').trim();
    if (!cleanNick) {
      throw new BadRequestException('Nickname cannot be empty');
    }

    let userId = existingUserId;
    if (!userId) {
      userId = `web_${uuidv4().replace(/-/g, '').slice(0, 12)}`;
    }

    const success = this.db.addUser(userId, cleanNick);
    if (!success) {
      throw new BadRequestException('Failed to register user. Please try again.');
    }

    return {
      userId,
      nickname: cleanNick,
    };
  }

  async getProfile(userId: string) {
    const user = this.db.getUser(userId);
    if (!user) {
      throw new BadRequestException('User not found');
    }
    const isParticipant = this.db.isGameParticipant(userId);
    return {
      userId: user.user_id,
      nickname: user.nickname,
      isParticipant,
    };
  }

  async joinGame(userId: string): Promise<{ success: boolean; participantCount: number; message: string }> {
    const user = this.db.getUser(userId);
    if (!user) {
      throw new BadRequestException('You need to register first!');
    }

    const gameState = this.db.getGameState();
    if (!gameState.is_active) {
      throw new BadRequestException('No active game found. Wait for a game to be started!');
    }

    if (this.db.isGameParticipant(userId)) {
      const participants = this.db.getGameParticipants();
      return {
        success: true,
        participantCount: Object.keys(participants).length,
        message: 'You are already participating in this game!',
      };
    }

    const success = this.db.addGameParticipant(userId, user.nickname);
    if (!success) {
      throw new BadRequestException('Failed to join game. Please try again.');
    }

    const participants = this.db.getGameParticipants();
    const count = Object.keys(participants).length;

    // Broadcast via RabbitMQ to Telegram players
    const notificationMessage = `👋 ${user.nickname} joined the game! (${count} players total)`;
    this.rabbitmq.sendBroadcast(notificationMessage, userId);

    // Broadcast via Socket.IO to Web players
    this.eventsGateway.broadcastPlayerJoined(user.nickname, count, userId);

    // Broadcast full updated dashboard data to Admin View
    this.eventsGateway.broadcastDashboardRefresh(this.adminService.getDashboardData());

    return {
      success: true,
      participantCount: count,
      message: `🎮 Successfully joined the game! You are participant #${count}.`,
    };
  }

  async submitAnswer(
    userId: string,
    answer: string,
  ): Promise<{ success: boolean; questionNumber: number; answer: string; message: string }> {
    const cleanAnswer = (answer || '').trim();
    if (!cleanAnswer) {
      throw new BadRequestException('Answer cannot be empty');
    }

    const user = this.db.getUser(userId);
    if (!user) {
      throw new BadRequestException('You need to register first!');
    }

    const gameState = this.db.getGameState();
    if (!gameState.is_active) {
      throw new BadRequestException('Game is not currently active');
    }

    if (!gameState.collecting_answers || !gameState.current_question || gameState.current_question <= 0) {
      throw new BadRequestException('Not currently accepting answers for any question');
    }

    const questionNumber = gameState.current_question;
    const success = this.db.saveAnswer(userId, questionNumber, cleanAnswer);
    if (!success) {
      throw new BadRequestException('Error saving answer. Please try again.');
    }

    // Automatic answer evaluation with fuzzy matching if host configured an answer key
    const answerKey = this.db.getQuestionAnswerKey(questionNumber);
    if (answerKey !== null && answerKey !== undefined && answerKey.trim() !== '') {
      const isCorrect = isFuzzyAnswerMatch(cleanAnswer, answerKey);
      this.db.setCorrectAnswerStatus(userId, questionNumber, isCorrect);
      
      // Update leaderboard
      const updatedLeaderboard = this.db.calculateLeaderboard();
      this.eventsGateway.broadcastLeaderboard(updatedLeaderboard);
    }

    // Broadcast to Admin and other components
    this.eventsGateway.broadcastAnswerReceived(userId, user.nickname, questionNumber);
    this.eventsGateway.broadcastDashboardRefresh(this.adminService.getDashboardData());

    return {
      success: true,
      questionNumber: questionNumber,
      answer: cleanAnswer,
      message: `Answer recorded for Question ${questionNumber}!`,
    };
  }

  async getStatus(userId?: string): Promise<{
    gameState: GameState;
    participantCount: number;
    isParticipant: boolean;
    currentAnswer: string | null;
    nickname: string | null;
  }> {
    const gameState = this.db.getGameState();
    const participants = this.db.getGameParticipants();
    const participantCount = Object.keys(participants).length;

    let isParticipant = false;
    let currentAnswer: string | null = null;
    let nickname: string | null = null;

    if (userId) {
      const user = this.db.getUser(userId);
      if (user) {
        nickname = user.nickname;
        isParticipant = this.db.isGameParticipant(userId);
        if (gameState.current_question > 0) {
          currentAnswer = this.db.getUserAnswerForQuestion(userId, gameState.current_question);
        }
      }
    }

    return {
      gameState,
      participantCount,
      isParticipant,
      currentAnswer,
      nickname,
    };
  }

  getLeaderboard(): LeaderboardEntry[] {
    return this.db.calculateLeaderboard();
  }
}
