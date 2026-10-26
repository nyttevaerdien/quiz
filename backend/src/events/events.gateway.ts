import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { GameState, LeaderboardEntry } from '../database/database.service';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(EventsGateway.name);
  private connectedClientsCount = 0;

  handleConnection(client: Socket) {
    this.connectedClientsCount++;
    this.logger.log(`Client connected: ${client.id} (Total: ${this.connectedClientsCount})`);
  }

  handleDisconnect(client: Socket) {
    this.connectedClientsCount--;
    this.logger.log(`Client disconnected: ${client.id} (Total: ${this.connectedClientsCount})`);
  }

  // --- Real-time Broadcast Methods ---

  broadcastGameState(state: GameState) {
    this.server?.emit('gameStateUpdated', state);
  }

  broadcastQuestion(questionNumber: number) {
    this.server?.emit('questionStarted', {
      current_question: questionNumber,
      collecting_answers: true,
      grading_phase: false,
    });
  }

  broadcastGradingPhase() {
    this.server?.emit('gradingStarted', {
      collecting_answers: false,
      grading_phase: true,
    });
  }

  broadcastGameStarted() {
    this.server?.emit('gameStarted', {
      message: '🎮 Game has started!',
    });
  }

  broadcastGameEnded() {
    this.server?.emit('gameEnded', {
      message: '🏁 Game has ended! Thank you for participating.',
    });
  }

  broadcastPlayerJoined(nickname: string, totalCount: number, userId: string) {
    this.server?.emit('playerJoined', {
      nickname,
      totalCount,
      userId,
      message: `👋 ${nickname} joined the game! (${totalCount} players total)`,
    });
  }

  broadcastAnswerReceived(userId: string, nickname: string, questionNumber: number) {
    this.server?.emit('answerSubmitted', {
      userId,
      nickname,
      questionNumber,
    });
  }

  broadcastLeaderboard(leaderboard: LeaderboardEntry[]) {
    this.server?.emit('leaderboardUpdated', leaderboard);
  }

  broadcastDashboardRefresh(refreshData: any) {
    this.server?.emit('dashboardRefreshed', refreshData);
  }

  broadcastAnnouncement(message: string) {
    this.server?.emit('announcement', { message });
  }

  @SubscribeMessage('ping')
  handlePing(client: Socket) {
    client.emit('pong', { time: Date.now() });
  }
}
