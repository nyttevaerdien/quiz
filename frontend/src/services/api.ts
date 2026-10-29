import { DashboardData, LeaderboardEntry, PlayerStatusResponse } from '../types';

const BASE_URL = '';

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${BASE_URL}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  const res = await fetch(url, { ...options, headers });
  if (!res.ok) {
    let errMessage = `Error ${res.status}: ${res.statusText}`;
    try {
      const errorJson = await res.json();
      if (errorJson.message) {
        errMessage = Array.isArray(errorJson.message) ? errorJson.message.join(', ') : errorJson.message;
      }
    } catch {
      // ignore
    }
    throw new Error(errMessage);
  }
  return res.json();
}

export const api = {
  // Player Endpoints
  register: (nickname: string, userId?: string) =>
    request<{ userId: string; nickname: string }>('/api/player/register', {
      method: 'POST',
      body: JSON.stringify({ nickname, userId }),
    }),

  joinGame: (userId: string) =>
    request<{ success: boolean; participantCount: number; message: string }>('/api/player/join', {
      method: 'POST',
      body: JSON.stringify({ userId }),
    }),

  submitAnswer: (userId: string, answer: string) =>
    request<{ success: boolean; questionNumber: number; answer: string; message: string }>('/api/player/answer', {
      method: 'POST',
      body: JSON.stringify({ userId, answer }),
    }),

  getPlayerStatus: (userId?: string) =>
    request<PlayerStatusResponse>(`/api/player/status${userId ? `?userId=${encodeURIComponent(userId)}` : ''}`),

  getLeaderboard: () =>
    request<LeaderboardEntry[]>('/api/player/leaderboard'),

  // Admin Endpoints
  adminLogin: (password: string) =>
    request<{ success: boolean; token: string }>('/api/admin/login', {
      method: 'POST',
      body: JSON.stringify({ password }),
    }),

  getAdminDashboard: () =>
    request<DashboardData>('/api/admin/dashboard'),

  startGame: () =>
    request<{ success: boolean; message: string }>('/api/admin/start_game', {
      method: 'POST',
    }),

  endGame: () =>
    request<{ success: boolean; message: string }>('/api/admin/end_game', {
      method: 'POST',
    }),

  nextQuestion: () =>
    request<{ success: boolean; current_question: number }>('/api/admin/next_question', {
      method: 'POST',
    }),

  startGrading: () =>
    request<{ success: boolean; message: string }>('/api/admin/start_grading', {
      method: 'POST',
    }),

  toggleCorrect: (correct_key: string) =>
    request<{ success: boolean; is_correct: boolean; leaderboard: LeaderboardEntry[] }>('/api/admin/toggle_correct', {
      method: 'POST',
      body: JSON.stringify({ correct_key }),
    }),

  removeUser: (userId: string) =>
    request<{ success: boolean; message: string }>(`/api/admin/users/${encodeURIComponent(userId)}`, {
      method: 'DELETE',
    }),

  getAnswerKeys: () =>
    request<Record<number, string>>('/api/admin/answer_keys'),

  setAnswerKey: (questionNumber: number, correctAnswer: string) =>
    request<{ success: boolean; questionNumber: number; correctAnswer: string; answer_keys: Record<number, string> }>(
      '/api/admin/answer_keys',
      {
        method: 'POST',
        body: JSON.stringify({ questionNumber, correctAnswer }),
      },
    ),

  deleteAnswerKey: (questionNumber: number) =>
    request<{ success: boolean; answer_keys: Record<number, string> }>(
      `/api/admin/answer_keys/${questionNumber}`,
      {
        method: 'DELETE',
      },
    ),
};
