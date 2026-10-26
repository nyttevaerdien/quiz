import { DashboardData, GameState, LeaderboardEntry } from '../types';

const API_BASE = '/api';

export const api = {
  // Player API
  async register(nickname: string, existingUserId?: string) {
    const res = await fetch(`${API_BASE}/player/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nickname, existingUserId }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Failed to register');
    }
    return res.json() as Promise<{ userId: string; nickname: string; isNew: boolean }>;
  },

  async getProfile(userId: string) {
    const res = await fetch(`${API_BASE}/player/profile/${userId}`);
    if (!res.ok) throw new Error('Failed to get profile');
    return res.json();
  },

  async joinGame(userId: string) {
    const res = await fetch(`${API_BASE}/player/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Failed to join game');
    }
    return res.json() as Promise<{
      success: boolean;
      alreadyJoined: boolean;
      participantCount: number;
      message: string;
      gameState: GameState;
    }>;
  },

  async submitAnswer(userId: string, answer: string) {
    const res = await fetch(`${API_BASE}/player/answer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, answer }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Failed to submit answer');
    }
    return res.json() as Promise<{
      success: boolean;
      questionNumber: number;
      answer: string;
      message: string;
    }>;
  },

  async getPlayerStatus(userId?: string) {
    const query = userId ? `?userId=${encodeURIComponent(userId)}` : '';
    const res = await fetch(`${API_BASE}/player/status${query}`);
    if (!res.ok) throw new Error('Failed to fetch status');
    return res.json() as Promise<{
      gameState: GameState;
      participantCount: number;
      isParticipant: boolean;
      currentAnswer: string | null;
      nickname: string | null;
    }>;
  },

  async getLeaderboard() {
    const res = await fetch(`${API_BASE}/player/leaderboard`);
    if (!res.ok) throw new Error('Failed to fetch leaderboard');
    return res.json() as Promise<LeaderboardEntry[]>;
  },

  // Admin API
  async adminLogin(password: string) {
    const res = await fetch(`${API_BASE}/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Invalid password');
    }
    return res.json() as Promise<{ success: boolean; token: string; role: string }>;
  },

  async getAdminDashboard(): Promise<DashboardData> {
    const res = await fetch(`${API_BASE}/admin/dashboard`);
    if (!res.ok) throw new Error('Failed to fetch dashboard');
    return res.json();
  },

  async adminStartGame() {
    const res = await fetch(`${API_BASE}/admin/start_game`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) throw new Error('Failed to start game');
    return res.json();
  },

  async adminEndGame() {
    const res = await fetch(`${API_BASE}/admin/end_game`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Failed to end game');
    }
    return res.json();
  },

  async adminNextQuestion() {
    const res = await fetch(`${API_BASE}/admin/next_question`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Failed to move to next question');
    }
    return res.json();
  },

  async adminStartGrading() {
    const res = await fetch(`${API_BASE}/admin/start_grading`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Failed to start grading');
    }
    return res.json();
  },

  async adminToggleCorrect(correct_key: string) {
    const res = await fetch(`${API_BASE}/admin/toggle_correct`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ correct_key }),
    });
    if (!res.ok) throw new Error('Failed to toggle correct');
    return res.json() as Promise<{ success: boolean; is_correct: boolean; leaderboard: LeaderboardEntry[] }>;
  },

  async adminRemoveUser(userId: string) {
    const res = await fetch(`${API_BASE}/admin/users/${userId}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Failed to remove user');
    return res.json();
  },
};
