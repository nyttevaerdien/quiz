import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { RabbitMQService } from '../rabbitmq/rabbitmq.service';
import { EventsGateway } from '../events/events.gateway';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class PlayerService {
  constructor(
    private readonly db: DatabaseService,
    private readonly rabbitmq: RabbitMQService,
    private readonly eventsGateway: EventsGateway,
  ) {}

  async register(nickname: string, existingUserId?: string) {
    const cleanNick = (nickname || '').trim();
    if (!cleanNick) {
      throw new BadRequestException('Nickname is required and cannot be empty');
    }

    if (existingUserId) {
      const existingUser = this.db.getUser(existingUserId);
      if (existingUser) {
        // Update nickname if changed
        if (existingUser.nickname !== cleanNick) {
          this.db.addUser(existingUserId, cleanNick);
        }
        return {
          userId: existingUserId,
          nickname: cleanNick,
          isNew: false,
        };
      }
    }

    // Check if nickname already exists
    const userWithNick = this.db.getUserByNickname(cleanNick);
    if (userWithNick) {
      return {
        userId: userWithNick.user_id,
        nickname: userWithNick.nickname,
        isNew: false,
      };
    }

    // Generate new web user ID (alphanumeric, no underscores for universal compatibility)
    const newUserId = `w${Date.now().toString(36)}${uuidv4().replace(/-/g, '').substring(0, 6)}`;
    this.db.addUser(newUserId, cleanNick);

    return {
      userId: newUserId,
      nickname: cleanNick,
      isNew: true,
    };
  }

  async getProfile(userId: string) {
    const user = this.db.getUser(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    const isParticipant = this.db.isGameParticipant(userId);
    const gameState = this.db.getGameState();
    let currentAnswer = null;
    if (gameState.current_question > 0) {
      currentAnswer = this.db.getUserAnswerForQuestion(userId, gameState.current_question);
    }

    return {
      userId: user.user_id,
      nickname: user.nickname,
      isParticipant,
      gameState,
      currentAnswer,
    };
  }

  async joinGame(userId: string) {
    const user = this.db.getUser(userId);
    if (!user) {
      throw new BadRequestException('You need to register first!');
    }

    const gameState = this.db.getGameState();
    if (!gameState.is_active) {
      throw new BadRequestException('No active game found. Wait for a game to be started!');
    }

    const alreadyParticipant = this.db.isGameParticipant(userId);
    if (alreadyParticipant) {
      const participants = this.db.getGameParticipants();
      return {
        success: true,
        alreadyJoined: true,
        participantCount: Object.keys(participants).length,
        message: 'You are already participating in this game!',
        gameState,
      };
    }

    const added = this.db.addGameParticipant(userId, user.nickname);
    if (!added) {
      throw new BadRequestException('Failed to join the game. Please try again.');
    }

    const participants = this.db.getGameParticipants();
    const participantCount = Object.keys(participants).length;

    // Send RabbitMQ broadcast to Telegram players
    const notificationMessage = `👋 ${user.nickname} joined the game! (${participantCount} players total)`;
    await this.rabbitmq.sendBroadcast(notificationMessage, userId);

    // Broadcast to web clients via Socket.IO
    this.eventsGateway.broadcastPlayerJoined(user.nickname, participantCount, userId);

    return {
      success: true,
      alreadyJoined: false,
      participantCount,
      message: `Successfully joined the game! You are participant #${participantCount}.`,
      gameState,
    };
  }

  async submitAnswer(userId: string, answerText: string) {
    const user = this.db.getUser(userId);
    if (!user) {
      throw new BadRequestException('You need to register first!');
    }

    const gameState = this.db.getGameState();
    if (!gameState.is_active) {
      throw new BadRequestException('No active game is running.');
    }

    if (!gameState.collecting_answers || gameState.current_question <= 0) {
      throw new BadRequestException('Not currently accepting answers. Please wait for the next question.');
    }

    const cleanAnswer = (answerText || '').trim();
    if (!cleanAnswer) {
      throw new BadRequestException('Answer cannot be empty.');
    }

    // Save answer
    const saved = this.db.saveAnswer(userId, gameState.current_question, cleanAnswer);
    if (!saved) {
      throw new BadRequestException('Error saving answer. Please try again.');
    }

    // Notify admin via Socket.IO
    this.eventsGateway.broadcastAnswerReceived(userId, user.nickname, gameState.current_question);

    return {
      success: true,
      questionNumber: gameState.current_question,
      answer: cleanAnswer,
      message: `Answer recorded for Question ${gameState.current_question}!`,
    };
  }

  async getStatus(userId?: string) {
    const gameState = this.db.getGameState();
    const participants = this.db.getGameParticipants();
    const participantCount = Object.keys(participants).length;

    let isParticipant = false;
    let currentAnswer = null;
    let nickname = null;

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

  getLeaderboard() {
    return this.db.calculateLeaderboard();
  }
}
