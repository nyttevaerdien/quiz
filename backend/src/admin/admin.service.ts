import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { DatabaseService, GameState, LeaderboardEntry } from '../database/database.service';
import { RabbitMQService } from '../rabbitmq/rabbitmq.service';
import { EventsGateway } from '../events/events.gateway';
import { isFuzzyAnswerMatch } from '../common/fuzzy-matcher';

export interface DashboardData {
  table_data: Array<{
    player: string;
    user_id: string;
    [key: string]: any;
  }>;
  questions: string[];
  game_state: GameState;
  leaderboard: LeaderboardEntry[];
  users: Array<{
    user_id: string;
    nickname: string;
    is_participant: boolean;
  }>;
  player_count: number;
  question_count: number;
  answer_keys?: Record<number, string>;
}

@Injectable()
export class AdminService {
  private readonly ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin';

  constructor(
    private readonly db: DatabaseService,
    private readonly rabbitmq: RabbitMQService,
    private readonly eventsGateway: EventsGateway,
  ) {}

  login(password: string): { success: boolean; token: string } {
    if (password === this.ADMIN_PASSWORD) {
      return {
        success: true,
        token: `admin_token_${Date.now()}`,
      };
    }
    throw new UnauthorizedException('Invalid admin password');
  }

  getDashboardData(): DashboardData {
    const gameState = this.db.getGameState();
    const participants = this.db.getGameParticipants();
    const answers = this.db.getAllAnswers();
    const correctAnswers = this.db.getCorrectAnswers();
    const leaderboard = this.db.calculateLeaderboard();

    const answerKeys = this.db.getQuestionAnswerKeys();

    const questionNumbers = new Set<number>();
    for (const q of Object.keys(answers)) {
      if (q.startsWith('question_')) {
        const num = parseInt(q.split('_')[1], 10);
        if (!isNaN(num)) questionNumbers.add(num);
      }
    }
    if (gameState.current_question && gameState.current_question > 0) {
      questionNumbers.add(gameState.current_question);
    }
    for (const qNum of Object.keys(answerKeys)) {
      const num = parseInt(qNum, 10);
      if (!isNaN(num)) questionNumbers.add(num);
    }

    const sortedNums = Array.from(questionNumbers).sort((a, b) => a - b);
    const questions = sortedNums.map((n) => `question_${n}`);

    const tableData: any[] = [];
    for (const [userId, player] of Object.entries(participants)) {
      const row: any = { player, user_id: userId };
      for (const question of questions) {
        const questionNum = question.split('_')[1];
        let playerAnswer: string = '';

        if (answers[question] && answers[question][userId]) {
          playerAnswer = answers[question][userId].answer || '';
        }

        const correctKey = `${userId}_${questionNum}`;
        const isCorrect = Boolean(correctAnswers[correctKey]);

        row[`q${questionNum}`] = {
          answer: playerAnswer,
          is_correct: isCorrect,
          correct_key: correctKey,
        };
      }
      tableData.push(row);
    }

    const allUsers = this.db.getAllUsers();
    const usersList: any[] = [];
    for (const [uId, nick] of Object.entries(allUsers)) {
      usersList.push({
        user_id: uId,
        nickname: nick,
        is_participant: Boolean(participants[uId]),
      });
    }


    return {
      table_data: tableData,
      questions,
      game_state: gameState,
      leaderboard,
      users: usersList,
      player_count: Object.keys(participants).length,
      question_count: questions.length,
      answer_keys: answerKeys,
    };
  }

  startGame(startedBy: string = 'admin_web') {
    const backupFile = this.db.createBackup();

    this.db.startGame(startedBy);
    this.db.clearAnswers();
    this.db.clearCorrectAnswers();
    this.db.clearGameParticipants();

    // Broadcast to Telegram users via RabbitMQ
    this.rabbitmq.sendBroadcastAllUsers('🎮 Game started! Use /join_game to participate.');

    // Broadcast to Web users via Socket.IO
    this.eventsGateway.broadcastGameStarted();
    this.eventsGateway.broadcastGameState(this.db.getGameState());
    this.eventsGateway.broadcastDashboardRefresh(this.getDashboardData());

    return {
      success: true,
      message: 'Game started successfully!',
      backup_file: backupFile,
      game_state: this.db.getGameState(),
    };
  }

  endGame() {
    const gameState = this.db.getGameState();
    if (!gameState.is_active) {
      throw new BadRequestException('No game is currently active!');
    }

    // Broadcast before clearing participants
    this.rabbitmq.sendBroadcast('🏁 Game ended! Thank you for participating.');
    this.eventsGateway.broadcastGameEnded();

    this.db.endGame();
    this.db.clearGameParticipants();

    this.eventsGateway.broadcastGameState(this.db.getGameState());
    this.eventsGateway.broadcastDashboardRefresh(this.getDashboardData());

    return {
      success: true,
      message: 'Game ended successfully!',
      game_state: this.db.getGameState(),
    };
  }

  nextQuestion() {
    const gameState = this.db.getGameState();
    if (!gameState.is_active) {
      throw new BadRequestException('No game is currently active!');
    }

    this.db.nextQuestion();
    const updatedState = this.db.getGameState();

    // Broadcast to Telegram players
    this.rabbitmq.sendBroadcast(`📝 Now answering to question ${updatedState.current_question}`);

    // Broadcast to Web players
    this.eventsGateway.broadcastQuestionStarted(updatedState.current_question);
    this.eventsGateway.broadcastGameState(updatedState);
    this.eventsGateway.broadcastDashboardRefresh(this.getDashboardData());

    return {
      success: true,
      current_question: updatedState.current_question,
      game_state: updatedState,
    };
  }

  startGrading() {
    const gameState = this.db.getGameState();
    if (!gameState.is_active) {
      throw new BadRequestException('No game is currently active!');
    }

    this.db.startGradingPhase();
    const updatedState = this.db.getGameState();

    // Broadcast to Telegram players
    this.rabbitmq.sendBroadcast('📊 Grading phase started! Answers are now being reviewed.');

    // Broadcast to Web players
    this.eventsGateway.broadcastGradingStarted();
    this.eventsGateway.broadcastGameState(updatedState);
    this.eventsGateway.broadcastDashboardRefresh(this.getDashboardData());

    return {
      success: true,
      message: 'Grading phase started! Answers collection stopped.',
      game_state: updatedState,
    };
  }

  toggleCorrect(correctKey: string) {
    if (!correctKey) {
      throw new BadRequestException('Missing correct_key');
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

  // Answer Keys Management
  setAnswerKey(questionNumber: number, correctAnswer: string) {
    if (!questionNumber || questionNumber <= 0) {
      throw new BadRequestException('Invalid question number');
    }
    const cleanAnswer = (correctAnswer || '').trim();
    if (!cleanAnswer) {
      throw new BadRequestException('Correct answer cannot be empty');
    }

    const success = this.db.setQuestionAnswerKey(questionNumber, cleanAnswer);
    if (!success) {
      throw new BadRequestException('Failed to save answer key');
    }

    // Automatically re-evaluate any already submitted answers for this question using fuzzy matching
    const answersMap = this.db.getAllAnswers();
    const qKey = `question_${questionNumber}`;

    if (answersMap[qKey]) {
      for (const [userId, item] of Object.entries(answersMap[qKey])) {
        const isCorrect = isFuzzyAnswerMatch(item.answer, cleanAnswer);
        this.db.setCorrectAnswerStatus(userId, questionNumber, isCorrect);
      }
    }

    const dashboard = this.getDashboardData();
    this.eventsGateway.broadcastDashboardRefresh(dashboard);
    this.eventsGateway.broadcastLeaderboard(dashboard.leaderboard);

    return {
      success: true,
      questionNumber,
      correctAnswer: cleanAnswer,
      answer_keys: this.db.getQuestionAnswerKeys(),
    };
  }

  deleteAnswerKey(questionNumber: number) {
    if (!questionNumber || questionNumber <= 0) {
      throw new BadRequestException('Invalid question number');
    }
    this.db.deleteQuestionAnswerKey(questionNumber);

    const dashboard = this.getDashboardData();
    this.eventsGateway.broadcastDashboardRefresh(dashboard);

    return {
      success: true,
      answer_keys: this.db.getQuestionAnswerKeys(),
    };
  }

  getAnswerKeys() {
    return this.db.getQuestionAnswerKeys();
  }
}
