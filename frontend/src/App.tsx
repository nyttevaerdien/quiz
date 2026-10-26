import React, { useState, useEffect, useCallback } from 'react';
import { GameState, LeaderboardEntry, DashboardData } from './types';
import { Navbar } from './components/Navbar';
import { PlayerView } from './components/PlayerView';
import { AdminView } from './components/AdminView';
import { getSocket } from './services/socket';
import { api } from './services/api';

export const App: React.FC = () => {
  // Navigation / Mode
  const [mode, setMode] = useState<'player' | 'admin'>('player');

  // Socket Connection
  const [isConnected, setIsConnected] = useState(false);

  // Player State
  const [userId, setUserId] = useState<string | null>(() => localStorage.getItem('quiz_user_id'));
  const [nickname, setNickname] = useState<string | null>(() => localStorage.getItem('quiz_nickname'));
  const [showNickModal, setShowNickModal] = useState(false);
  const [tempNick, setTempNick] = useState('');

  // Admin State
  const [adminToken, setAdminToken] = useState<string | null>(() => localStorage.getItem('quiz_admin_token'));
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);

  // Shared Game State
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
  const [announcement, setAnnouncement] = useState<string | null>(null);

  const triggerAnnouncement = (text: string) => {
    setAnnouncement(text);
    setTimeout(() => setAnnouncement(null), 6000);
  };

  // Fetch initial game state and leaderboard
  const refreshStatus = useCallback(async () => {
    try {
      const status = await api.getPlayerStatus(userId || undefined);
      setGameState(status.gameState);
      setParticipantCount(status.participantCount);
      if (status.nickname && !nickname) {
        setNickname(status.nickname);
        localStorage.setItem('quiz_nickname', status.nickname);
      }
    } catch (err) {
      console.error('Failed to refresh status:', err);
    }
  }, [userId, nickname]);

  const refreshLeaderboard = useCallback(async () => {
    try {
      const data = await api.getLeaderboard();
      setLeaderboard(data);
    } catch (err) {
      console.error('Failed to refresh leaderboard:', err);
    }
  }, []);

  const refreshAdminDashboard = useCallback(async () => {
    if (!adminToken) return;
    try {
      const data = await api.getAdminDashboard();
      setDashboardData(data);
      setGameState(data.game_state);
      setLeaderboard(data.leaderboard);
      setParticipantCount(data.player_count);
    } catch (err) {
      console.error('Failed to refresh dashboard:', err);
    }
  }, [adminToken]);

  // Initial load
  useEffect(() => {
    refreshStatus();
    refreshLeaderboard();
    if (adminToken) {
      refreshAdminDashboard();
    }
  }, [refreshStatus, refreshLeaderboard, refreshAdminDashboard, adminToken]);

  // WebSocket listeners
  useEffect(() => {
    const socket = getSocket();

    socket.on('connect', () => {
      setIsConnected(true);
      refreshStatus();
      refreshLeaderboard();
      if (adminToken) refreshAdminDashboard();
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    socket.on('gameStateUpdated', (state: GameState) => {
      setGameState(state);
    });

    socket.on('questionStarted', (data: any) => {
      setGameState(prev => ({
        ...prev,
        current_question: data.current_question,
        collecting_answers: true,
        grading_phase: false,
      }));
      triggerAnnouncement(`📝 Question #${data.current_question} is now open! Submit your answer.`);
      if (adminToken) refreshAdminDashboard();
    });

    socket.on('gradingStarted', () => {
      setGameState(prev => ({
        ...prev,
        collecting_answers: false,
        grading_phase: true,
      }));
      triggerAnnouncement('📊 Answers closed! Grading in progress.');
      if (adminToken) refreshAdminDashboard();
    });

    socket.on('gameStarted', (data: any) => {
      setGameState(prev => ({
        ...prev,
        is_active: true,
        current_question: 0,
        collecting_answers: false,
        grading_phase: false,
      }));
      triggerAnnouncement(data?.message || '🎮 Game started! Join to participate.');
      refreshLeaderboard();
      if (adminToken) refreshAdminDashboard();
    });

    socket.on('gameEnded', (data: any) => {
      setGameState(prev => ({
        ...prev,
        is_active: false,
        collecting_answers: false,
        grading_phase: false,
      }));
      triggerAnnouncement(data?.message || '🏁 Game has ended. Thanks for playing!');
      refreshLeaderboard();
      if (adminToken) refreshAdminDashboard();
    });

    socket.on('playerJoined', (data: any) => {
      setParticipantCount(data.totalCount);
      triggerAnnouncement(`👋 ${data.nickname} joined the game! (${data.totalCount} players)`);
      if (adminToken) refreshAdminDashboard();
    });

    socket.on('answerSubmitted', () => {
      if (adminToken) refreshAdminDashboard();
    });

    socket.on('leaderboardUpdated', (newLeaderboard: LeaderboardEntry[]) => {
      setLeaderboard(newLeaderboard);
      if (adminToken) refreshAdminDashboard();
    });

    socket.on('dashboardRefreshed', (data: DashboardData) => {
      setDashboardData(data);
      setGameState(data.game_state);
      setLeaderboard(data.leaderboard);
      setParticipantCount(data.player_count);
    });

    socket.on('announcement', (data: any) => {
      if (data?.message) triggerAnnouncement(data.message);
    });

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('gameStateUpdated');
      socket.off('questionStarted');
      socket.off('gradingStarted');
      socket.off('gameStarted');
      socket.off('gameEnded');
      socket.off('playerJoined');
      socket.off('answerSubmitted');
      socket.off('leaderboardUpdated');
      socket.off('dashboardRefreshed');
      socket.off('announcement');
    };
  }, [adminToken, refreshStatus, refreshLeaderboard, refreshAdminDashboard]);

  // Player registration handler
  const handleRegistered = (newUserId: string, newNickname: string) => {
    setUserId(newUserId);
    setNickname(newNickname);
    localStorage.setItem('quiz_user_id', newUserId);
    localStorage.setItem('quiz_nickname', newNickname);
    refreshStatus();
  };

  // Change Nickname Modal
  const handleOpenNickModal = () => {
    setTempNick(nickname || '');
    setShowNickModal(true);
  };

  const handleSaveNickModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tempNick.trim()) return;
    try {
      const res = await api.register(tempNick.trim(), userId || undefined);
      handleRegistered(res.userId, res.nickname);
      setShowNickModal(false);
    } catch (err: any) {
      alert(err.message || 'Error updating nickname');
    }
  };

  // Admin login / logout
  const handleAdminLoginSuccess = (token: string) => {
    setAdminToken(token);
    localStorage.setItem('quiz_admin_token', token);
    refreshAdminDashboard();
  };

  const handleAdminLogout = () => {
    setAdminToken(null);
    localStorage.removeItem('quiz_admin_token');
    setDashboardData(null);
    setMode('player');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      {/* Top Navbar */}
      <Navbar
        mode={mode}
        onSwitchMode={(m) => setMode(m)}
        isConnected={isConnected}
        playerNickname={nickname}
        isAdminLoggedIn={Boolean(adminToken)}
        onAdminLogout={handleAdminLogout}
        onChangeNickname={handleOpenNickModal}
      />

      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-6xl mx-auto px-2 sm:px-4 py-4">
        {mode === 'player' ? (
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
            isLoggedIn={Boolean(adminToken)}
            onLoginSuccess={handleAdminLoginSuccess}
            dashboardData={dashboardData}
            onRefreshDashboard={refreshAdminDashboard}
          />
        )}
      </main>

      {/* Nickname Change Modal */}
      {showNickModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 w-full max-w-sm shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-2">Change Nickname</h3>
            <p className="text-xs text-slate-400 mb-4">
              Enter your updated display name:
            </p>
            <form onSubmit={handleSaveNickModal} className="space-y-4">
              <input
                type="text"
                value={tempNick}
                onChange={(e) => setTempNick(e.target.value)}
                maxLength={25}
                required
                className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
                autoFocus
              />
              <div className="flex space-x-2">
                <button
                  type="button"
                  onClick={() => setShowNickModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold"
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
