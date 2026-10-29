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
  private readonly logger = new Logger(EventsGateway.name);
  private connectedClientsCount = 0;

  @WebSocketServer()
  server: Server;

  handleConnection(client: Socket) {
    this.connectedClientsCount++;
    this.logger.log(`Client connected: ${client.id} (Total: ${this.connectedClientsCount})`);
  }

  handleDisconnect(client: Socket) {
    this.connectedClientsCount--;
    this.logger.log(`Client disconnected: ${client.id} (Total: ${this.connectedClientsCount})`);
  }

  // --- Broadcast methods ---
  broadcastGameState(gameState: GameState) {
    this.server?.emit('gameStateChanged', gameState);
  }

  broadcastQuestionStarted(questionNumber: number) {
    this.server?.emit('questionStarted', {
      questionNumber,
      message: `📝 Question ${questionNumber} is now active! Submit your answer.`,
    });
  }

  broadcastGradingStarted() {
    this.server?.emit('gradingStarted', {
      message: '📊 Answers are being graded by the host!',
    });
  }

  broadcastGameStarted() {
    this.server?.emit('gameStarted', {
      message: '🎮 A new game has started! Click Join Game to play.',
    });
  }

  broadcastGameEnded() {
    this.server?.emit('gameEnded', {
      message: '🏁 Game has ended! Check the final leaderboard.',
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
