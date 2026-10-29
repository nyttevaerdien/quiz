import React, { useState, useEffect, useCallback } from 'react';
import { Navbar } from './components/Navbar';
import { PlayerView } from './components/PlayerView';
import { AdminView } from './components/AdminView';
import { api } from './services/api';
import { getSocket } from './services/socket';
import { DashboardData, GameState, LeaderboardEntry } from './types';

export const App: React.FC = () => {
  // Navigation Role
  const [role, setRole] = useState<'player' | 'admin'>('player');

  // Player session stored in localStorage
  const [userId, setUserId] = useState<string | null>(() => localStorage.getItem('quiz_user_id'));
  const [nickname, setNickname] = useState<string | null>(() => localStorage.getItem('quiz_nickname'));

  // Admin session
  const [adminToken, setAdminToken] = useState<string | null>(() => localStorage.getItem('quiz_admin_token'));

  // Live state
  const [gameState, setGameState] = useState<GameState>({
    is_active: false,
    started_by: null,
    start_time: null,
    current_question: 0,
    collecting_answers: false,
    grading_phase: false,
  });

  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [participantCount, setParticipantCount] = useState<number>(0);
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [socketConnected, setSocketConnected] = useState<boolean>(false);
  const [announcement, setAnnouncement] = useState<string | null>(null);

  // Fetch initial player status & leaderboard
  const refreshPlayerStatus = useCallback(async () => {
    try {
      const status = await api.getPlayerStatus(userId || undefined);
      setGameState(status.gameState);
      setParticipantCount(status.participantCount);
      if (status.nickname && !nickname) {
        setNickname(status.nickname);
        localStorage.setItem('quiz_nickname', status.nickname);
      }
    } catch (e) {
      // ignore
    }

    try {
      const lb = await api.getLeaderboard();
      setLeaderboard(lb);
    } catch (e) {
      // ignore
    }
  }, [userId, nickname]);

  // Fetch admin dashboard data
  const refreshAdminDashboard = useCallback(async () => {
    try {
      const data = await api.getAdminDashboard();
      setDashboardData(data);
      setGameState(data.game_state);
      setLeaderboard(data.leaderboard);
      setParticipantCount(data.player_count);
    } catch (e) {
      // ignore
    }
  }, []);

  // Sync state initially
  useEffect(() => {
    refreshPlayerStatus();
    if (adminToken) {
      refreshAdminDashboard();
    }
  }, [refreshPlayerStatus, refreshAdminDashboard, adminToken]);

  // Socket.IO event subscriptions
  useEffect(() => {
    const socket = getSocket();

    const onConnect = () => setSocketConnected(true);
    const onDisconnect = () => setSocketConnected(false);

    const onGameStateChanged = (state: GameState) => {
      setGameState(state);
    };

    const onQuestionStarted = (data: { questionNumber: number; message: string }) => {
      setGameState((prev) => ({
        ...prev,
        current_question: data.questionNumber,
        collecting_answers: true,
        grading_phase: false,
      }));
      setAnnouncement(data.message);
      setTimeout(() => setAnnouncement(null), 6000);
      refreshPlayerStatus();
    };

    const onGradingStarted = (data: { message: string }) => {
      setGameState((prev) => ({
        ...prev,
        collecting_answers: false,
        grading_phase: true,
      }));
      setAnnouncement(data.message);
      setTimeout(() => setAnnouncement(null), 6000);
    };

    const onGameStarted = (data: { message: string }) => {
      setGameState({
        is_active: true,
        started_by: 'Host',
        start_time: new Date().toISOString(),
        current_question: 0,
        collecting_answers: false,
        grading_phase: false,
      });
      setAnnouncement(data.message);
      setTimeout(() => setAnnouncement(null), 6000);
      refreshPlayerStatus();
    };

    const onGameEnded = (data: { message: string }) => {
      setGameState({
        is_active: false,
        started_by: null,
        start_time: null,
        current_question: 0,
        collecting_answers: false,
        grading_phase: false,
      });
      setAnnouncement(data.message);
      setTimeout(() => setAnnouncement(null), 8000);
      refreshPlayerStatus();
    };

    const onPlayerJoined = (data: { nickname: string; totalCount: number }) => {
      setParticipantCount(data.totalCount);
      setDashboardData((prev) => (prev ? { ...prev, player_count: data.totalCount } : prev));
      setAnnouncement(`👋 ${data.nickname} joined the game!`);
      setTimeout(() => setAnnouncement(null), 4000);
      if (adminToken) {
        refreshAdminDashboard();
      }
    };

    const onLeaderboardUpdated = (newLeaderboard: LeaderboardEntry[]) => {
      setLeaderboard(newLeaderboard);
    };

    const onDashboardRefreshed = (data: DashboardData) => {
      setDashboardData(data);
      setGameState(data.game_state);
      setLeaderboard(data.leaderboard);
      setParticipantCount(data.player_count);
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('gameStateChanged', onGameStateChanged);
    socket.on('questionStarted', onQuestionStarted);
    socket.on('gradingStarted', onGradingStarted);
    socket.on('gameStarted', onGameStarted);
    socket.on('gameEnded', onGameEnded);
    socket.on('playerJoined', onPlayerJoined);
    socket.on('leaderboardUpdated', onLeaderboardUpdated);
    socket.on('dashboardRefreshed', onDashboardRefreshed);

    if (socket.connected) {
      setSocketConnected(true);
    }

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('gameStateChanged', onGameStateChanged);
      socket.off('questionStarted', onQuestionStarted);
      socket.off('gradingStarted', onGradingStarted);
      socket.off('gameStarted', onGameStarted);
      socket.off('gameEnded', onGameEnded);
      socket.off('playerJoined', onPlayerJoined);
      socket.off('leaderboardUpdated', onLeaderboardUpdated);
      socket.off('dashboardRefreshed', onDashboardRefreshed);
    };
  }, [refreshPlayerStatus]);

  // Handler when player registers
  const handleRegistered = (newUserId: string, newNickname: string) => {
    setUserId(newUserId);
    setNickname(newNickname);
    localStorage.setItem('quiz_user_id', newUserId);
    localStorage.setItem('quiz_nickname', newNickname);
    refreshPlayerStatus();
  };

  // Handler when admin logs in
  const handleAdminLogin = (token: string) => {
    setAdminToken(token);
    localStorage.setItem('quiz_admin_token', token);
    refreshAdminDashboard();
  };

  const handleAdminLogout = () => {
    setAdminToken(null);
    localStorage.removeItem('quiz_admin_token');
    setRole('player');
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col font-sans transition-colors">
      <Navbar
        currentRole={role}
        onRoleChange={setRole}
        nickname={nickname}
        isAdminLoggedIn={!!adminToken}
        onAdminLogout={handleAdminLogout}
        socketConnected={socketConnected}
      />

      <main className="flex-1 px-3 sm:px-4 py-4 safe-bottom">
        {role === 'player' ? (
          <PlayerView
            userId={userId}
            nickname={nickname}
            onRegistered={handleRegistered}
            gameState={gameState}
            leaderboard={leaderboard}
            participantCount={participantCount}
            announcement={announcement}
          />
        ) : (
          <AdminView
            isLoggedIn={!!adminToken}
            onLoginSuccess={handleAdminLogin}
            dashboardData={dashboardData}
            onRefreshDashboard={refreshAdminDashboard}
          />
        )}
      </main>
    </div>
  );
};

export default App;
