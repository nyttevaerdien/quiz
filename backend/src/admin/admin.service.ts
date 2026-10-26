import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { RabbitMQService } from '../rabbitmq/rabbitmq.service';
import { EventsGateway } from '../events/events.gateway';

@Injectable()
export class AdminService {
  private readonly ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin';

  constructor(
    private readonly db: DatabaseService,
    private readonly rabbitmq: RabbitMQService,
    private readonly eventsGateway: EventsGateway,
  ) {}

  login(password: string) {
    if (password === this.ADMIN_PASSWORD) {
      return {
        success: true,
        token: 'quiz_admin_token_' + Buffer.from(this.ADMIN_PASSWORD).toString('base64'),
        role: 'admin',
      };
    }
    throw new UnauthorizedException('Invalid admin password');
  }

  getDashboardData() {
    const gameState = this.db.getGameState();
    const participants = this.db.getGameParticipants();
    const answers = this.db.getAllAnswers();
    const correctAnswers = this.db.getCorrectAnswers();
    const leaderboard = this.db.calculateLeaderboard();
    const allUsers = this.db.getAllUsers();

    // Unique questions sorted by number
    const questionKeys = Object.keys(answers)
      .filter(k => k.startsWith('question_'))
      .sort((a, b) => parseInt(a.split('_')[1], 10) - parseInt(b.split('_')[1], 10));

    // Construct table data for the answers matrix
    const tableData: any[] = [];
    for (const [userId, nickname] of Object.entries(participants)) {
      const row: any = {
        player: nickname,
        user_id: userId,
      };

      for (const qKey of questionKeys) {
        const qNum = qKey.split('_')[1];
        let playerAnswer = '';

        if (answers[qKey] && answers[qKey][userId]) {
          playerAnswer = answers[qKey][userId].answer || '';
        } else if (answers[qKey]) {
          // Fallback matching by nickname if needed
          for (const ansData of Object.values(answers[qKey])) {
            if (ansData.nickname === nickname) {
              playerAnswer = ansData.answer;
              break;
            }
          }
        }

        const correctKey = `${userId}_${qNum}`;
        const isCorrect = Boolean(correctAnswers[correctKey]);

        row[`q${qNum}`] = {
          answer: playerAnswer,
          is_correct: isCorrect,
          correct_key: correctKey,
        };
      }

      tableData.push(row);
    }

    const userData = Object.entries(allUsers).map(([userId, nickname]) => ({
      user_id: userId,
      nickname,
      is_participant: Boolean(participants[userId]),
    }));

    return {
      table_data: tableData,
      questions: questionKeys,
      game_state: gameState,
      leaderboard,
      users: userData,
      player_count: Object.keys(participants).length,
      question_count: questionKeys.length,
    };
  }

  async startGame(startedBy: string = 'admin_web') {
    // 1. Always backup previous results
    const backupFilename = this.db.createBackup();

    // 2. Start fresh: clear previous answers, correct answers, participants
    this.db.startGame(startedBy);
    this.db.clearAnswers();
    this.db.clearCorrectAnswers();
    this.db.clearGameParticipants();

    const gameState = this.db.getGameState();

    // 3. Broadcast to all users via RabbitMQ
    await this.rabbitmq.sendBroadcastAllUsers('🎮 Game started! Use /join_game to participate.');

    // 4. Broadcast via Socket.IO
    this.eventsGateway.broadcastGameStarted();
    this.eventsGateway.broadcastGameState(gameState);
    this.eventsGateway.broadcastAnnouncement('🎮 Game started! Join now to participate.');

    return {
      success: true,
      backupFilename,
      gameState,
      message: backupFilename ? `Game started! Previous results backed up.` : 'Game started!',
    };
  }

  async endGame() {
    const gameState = this.db.getGameState();
    if (!gameState.is_active) {
      throw new BadRequestException('No game is currently active!');
    }

    // 1. Broadcast to participants before clearing
    await this.rabbitmq.sendBroadcast('🏁 Game ended! Thank you for participating.');

    // 2. Update DB
    this.db.endGame();
    this.db.clearGameParticipants();

    const updatedState = this.db.getGameState();

    // 3. Broadcast via Socket.IO
    this.eventsGateway.broadcastGameEnded();
    this.eventsGateway.broadcastGameState(updatedState);
    this.eventsGateway.broadcastAnnouncement('🏁 Game ended! Thank you for participating.');

    return {
      success: true,
      gameState: updatedState,
      message: 'Game ended successfully!',
    };
  }

  async nextQuestion() {
    const gameState = this.db.getGameState();
    if (!gameState.is_active) {
      throw new BadRequestException('No game is currently active!');
    }

    this.db.nextQuestion();
    const updatedState = this.db.getGameState();

    // Broadcast to Telegram
    await this.rabbitmq.sendBroadcast(`📝 Now answering to question ${updatedState.current_question}`);

    // Broadcast to Web
    this.eventsGateway.broadcastQuestion(updatedState.current_question);
    this.eventsGateway.broadcastGameState(updatedState);
    this.eventsGateway.broadcastAnnouncement(`📝 Question ${updatedState.current_question} is now active! Submit your answers.`);

    return {
      success: true,
      currentQuestion: updatedState.current_question,
      gameState: updatedState,
      message: `Question ${updatedState.current_question} is now active!`,
    };
  }

  async startGrading() {
    const gameState = this.db.getGameState();
    if (!gameState.is_active) {
      throw new BadRequestException('No game is currently active!');
    }

    this.db.startGradingPhase();
    const updatedState = this.db.getGameState();

    // Broadcast to Telegram
    await this.rabbitmq.sendBroadcast('📊 Grading phase started! Answers are now being reviewed.');

    // Broadcast to Web
    this.eventsGateway.broadcastGradingPhase();
    this.eventsGateway.broadcastGameState(updatedState);
    this.eventsGateway.broadcastAnnouncement('📊 Grading phase started! Reviewing answers.');

    return {
      success: true,
      gameState: updatedState,
      message: 'Grading phase started! You can now review and grade answers.',
    };
  }

  toggleCorrect(correctKey: string) {
    if (!correctKey || !correctKey.includes('_')) {
      throw new BadRequestException('Invalid correct_key format');
    }

    const lastUnderscore = correctKey.lastIndexOf('_');
    if (lastUnderscore === -1) {
      throw new BadRequestException('Invalid correct_key format');
    }

    const userId = correctKey.substring(0, lastUnderscore);
    const qStr = correctKey.substring(lastUnderscore + 1);
    const questionNumber = parseInt(qStr, 10);
    if (isNaN(questionNumber)) {
      throw new BadRequestException('Invalid question number');
    }

    const result = this.db.toggleCorrectAnswer(userId, questionNumber);
    if (!result.success) {
      throw new BadRequestException('Failed to toggle correct answer');
    }

    const leaderboard = this.db.calculateLeaderboard();
    this.eventsGateway.broadcastLeaderboard(leaderboard);

    return {
      success: true,
      is_correct: result.is_correct,
      leaderboard,
    };
  }

  removeUser(userId: string) {
    const success = this.db.removeUser(userId);
    if (!success) {
      throw new BadRequestException(`Failed to remove user ${userId}`);
    }
    const dashboard = this.getDashboardData();
    this.eventsGateway.broadcastDashboardRefresh(dashboard);
    return {
      success: true,
      message: `User ${userId} removed successfully.`,
    };
  }
}
