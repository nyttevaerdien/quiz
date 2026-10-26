import React, { useState, useEffect } from 'react';
import { DashboardData } from '../types';
import { api } from '../services/api';
import { LeaderboardView } from './LeaderboardView';
import {
  Play,
  SkipForward,
  CheckCircle,
  Square,
  Lock,
  RefreshCw,
  Users,
  Award,
  Trash2,
  AlertCircle,
  Check,
  X,
  Shield,
} from 'lucide-react';

interface AdminViewProps {
  isLoggedIn: boolean;
  onLoginSuccess: (token: string) => void;
  dashboardData: DashboardData | null;
  onRefreshDashboard: () => void;
}

export const AdminView: React.FC<AdminViewProps> = ({
  isLoggedIn,
  onLoginSuccess,
  dashboardData,
  onRefreshDashboard,
}) => {
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const [activeTab, setActiveTab] = useState<'answers' | 'leaderboard' | 'users' | 'game'>('answers');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showFeedback = (message: string, type: 'success' | 'error' = 'success') => {
    setFeedback({ message, type });
    setTimeout(() => setFeedback(null), 4000);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;
    setIsLoggingIn(true);
    setLoginError(null);
    try {
      const res = await api.adminLogin(password);
      onLoginSuccess(res.token);
    } catch (err: any) {
      setLoginError(err.message || 'Invalid password');
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Actions
  const handleStartGame = async () => {
    if (!confirm('Start a new game? Previous answers will be backed up and participants reset.')) return;
    setActionLoading('start_game');
    try {
      const res = await api.adminStartGame();
      showFeedback(res.message || 'Game started!');
      onRefreshDashboard();
    } catch (err: any) {
      showFeedback(err.message || 'Failed to start game', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleNextQuestion = async () => {
    setActionLoading('next_question');
    try {
      const res = await api.adminNextQuestion();
      showFeedback(res.message || `Question ${res.currentQuestion} started!`);
      onRefreshDashboard();
    } catch (err: any) {
      showFeedback(err.message || 'Failed to advance question', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleStartGrading = async () => {
    setActionLoading('start_grading');
    try {
      const res = await api.adminStartGrading();
      showFeedback(res.message || 'Grading phase started!');
      onRefreshDashboard();
    } catch (err: any) {
      showFeedback(err.message || 'Failed to start grading', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleEndGame = async () => {
    if (!confirm('Are you sure you want to end the current game?')) return;
    setActionLoading('end_game');
    try {
      const res = await api.adminEndGame();
      showFeedback(res.message || 'Game ended successfully!');
      onRefreshDashboard();
    } catch (err: any) {
      showFeedback(err.message || 'Failed to end game', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleToggleCorrect = async (correctKey: string) => {
    try {
      await api.adminToggleCorrect(correctKey);
      onRefreshDashboard();
    } catch (err: any) {
      showFeedback(err.message || 'Failed to toggle answer', 'error');
    }
  };

  const handleRemoveUser = async (userId: string, nickname: string) => {
    if (!confirm(`Are you sure you want to remove user "${nickname}" and delete their data?`)) return;
    try {
      await api.adminRemoveUser(userId);
      showFeedback(`User ${nickname} removed.`);
      onRefreshDashboard();
    } catch (err: any) {
      showFeedback(err.message || 'Failed to remove user', 'error');
    }
  };

  // If not logged in as admin
  if (!isLoggedIn) {
    return (
      <div className="max-w-md mx-auto px-4 py-12">
        <div className="bg-slate-800/80 backdrop-blur-xl border border-slate-700/80 rounded-3xl p-6 sm:p-8 shadow-2xl text-center">
          <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <Lock className="w-6 h-6" />
          </div>

          <h2 className="text-2xl font-extrabold text-white tracking-tight">Admin Login</h2>
          <p className="text-slate-400 text-xs mt-1 mb-6">
            Enter the host password to manage games, questions, and grading.
          </p>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password (default: admin)"
                required
                className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 font-medium"
              />
            </div>

            {loginError && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-xs flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{loginError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoggingIn || !password}
              className="w-full py-3.5 px-4 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 disabled:opacity-50 text-white font-bold rounded-xl shadow-lg shadow-amber-600/20 transition flex items-center justify-center space-x-2"
            >
              <Shield className="w-4 h-4" />
              <span>{isLoggingIn ? 'Logging in...' : 'Sign In as Admin'}</span>
            </button>
          </form>
        </div>
      </div>
    );
  }

  const gameState = dashboardData?.game_state;

  return (
    <div className="max-w-6xl mx-auto px-4 py-4 space-y-4 pb-20">
      {/* Toast Feedback */}
      {feedback && (
        <div
          className={`p-3 rounded-2xl text-xs font-semibold flex items-center justify-between shadow-xl transition animate-slide-in ${
            feedback.type === 'success'
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
              : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
          }`}
        >
          <span>{feedback.message}</span>
          <button onClick={() => setFeedback(null)} className="text-slate-400 hover:text-white ml-2">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Game Control Command Center */}
      <div className="bg-slate-800/80 border border-slate-700 rounded-3xl p-4 sm:p-6 shadow-xl backdrop-blur-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${
                gameState?.is_active
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'bg-slate-700 text-slate-400'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${gameState?.is_active ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`}></span>
                {gameState?.is_active ? 'GAME ACTIVE' : 'INACTIVE'}
              </span>

              {gameState?.is_active && (
                <span className="px-2.5 py-1 rounded-full text-xs font-extrabold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  Question #{gameState.current_question || 0}
                </span>
              )}

              {gameState?.collecting_answers && (
                <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Collecting Answers
                </span>
              )}

              {gameState?.grading_phase && (
                <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  Grading Phase
                </span>
              )}
            </div>

            <p className="text-xs text-slate-400 mt-1.5">
              {dashboardData?.player_count || 0} participants in game &bull; {dashboardData?.question_count || 0} questions recorded
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleStartGame}
              disabled={actionLoading !== null}
              className="flex-1 sm:flex-initial flex items-center justify-center space-x-1.5 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-600/20 transition active:scale-95 disabled:opacity-50"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>{gameState?.is_active ? 'Restart Game' : 'Start Game'}</span>
            </button>

            {gameState?.is_active && (
              <>
                <button
                  onClick={handleNextQuestion}
                  disabled={actionLoading !== null}
                  className="flex-1 sm:flex-initial flex items-center justify-center space-x-1.5 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md shadow-indigo-600/20 transition active:scale-95 disabled:opacity-50"
                >
                  <SkipForward className="w-3.5 h-3.5" />
                  <span>Next Question</span>
                </button>

                <button
                  onClick={handleStartGrading}
                  disabled={actionLoading !== null || gameState.grading_phase}
                  className="flex-1 sm:flex-initial flex items-center justify-center space-x-1.5 px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs shadow-md shadow-amber-600/20 transition active:scale-95 disabled:opacity-50"
                >
                  <CheckCircle className="w-3.5 h-3.5" />
                  <span>Start Grading</span>
                </button>

                <button
                  onClick={handleEndGame}
                  disabled={actionLoading !== null}
                  className="flex-1 sm:flex-initial flex items-center justify-center space-x-1.5 px-3 py-2.5 rounded-xl bg-rose-600/80 hover:bg-rose-600 text-white font-bold text-xs shadow-md shadow-rose-600/20 transition active:scale-95 disabled:opacity-50"
                >
                  <Square className="w-3.5 h-3.5 fill-current" />
                  <span>End Game</span>
                </button>
              </>
            )}

            <button
              onClick={onRefreshDashboard}
              className="p-2.5 rounded-xl bg-slate-700/80 hover:bg-slate-700 text-slate-300 transition"
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-slate-800/80 p-1 rounded-2xl border border-slate-700/60 overflow-x-auto">
        <button
          onClick={() => setActiveTab('answers')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${
            activeTab === 'answers'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          Answers Matrix ({dashboardData?.table_data.length || 0})
        </button>
        <button
          onClick={() => setActiveTab('leaderboard')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${
            activeTab === 'leaderboard'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          Live Leaderboard
        </button>
        <button
          onClick={() => setActiveTab('users')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${
            activeTab === 'users'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          Users ({dashboardData?.users.length || 0})
        </button>
        <button
          onClick={() => setActiveTab('game')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${
            activeTab === 'game'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          Game State
        </button>
      </div>

      {/* Tab 1: Answers Matrix */}
      {activeTab === 'answers' && (
        <div className="bg-slate-800/80 rounded-3xl border border-slate-700/70 overflow-hidden shadow-2xl backdrop-blur-md">
          <div className="px-5 py-4 border-b border-slate-700/60 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-white text-base">Grading Matrix</h3>
              <p className="text-xs text-slate-400">
                Click any checkmark to grade player answers in real-time.
              </p>
            </div>
          </div>

          {(!dashboardData?.table_data || dashboardData.table_data.length === 0) ? (
            <div className="p-8 text-center text-slate-400 text-xs">
              No participants have joined the game yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-900/60 text-slate-400 border-b border-slate-700/60 uppercase font-semibold tracking-wider text-[11px]">
                    <th className="py-3 px-4 sticky left-0 bg-slate-900/90 z-10">Player</th>
                    {dashboardData.questions.map((qKey) => (
                      <th key={qKey} className="py-3 px-4 min-w-[140px] text-center">
                        Q{qKey.split('_')[1]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/40">
                  {dashboardData.table_data.map((row) => (
                    <tr key={row.user_id} className="hover:bg-slate-700/30 transition">
                      <td className="py-3 px-4 font-bold text-white sticky left-0 bg-slate-800/95 z-10 whitespace-nowrap shadow-sm">
                        {row.player}
                      </td>
                      {dashboardData.questions.map((qKey) => {
                        const qNum = qKey.split('_')[1];
                        const cell = row[`q${qNum}`] as any;
                        if (!cell) return <td key={qKey} className="py-3 px-4 text-center text-slate-500">-</td>;

                        const hasAnswer = Boolean(cell.answer);
                        return (
                          <td key={qKey} className="py-2.5 px-3">
                            <div className="flex flex-col items-center justify-center p-2 rounded-xl bg-slate-900/40 border border-slate-700/50">
                              <span className="text-[11px] font-medium text-slate-200 text-center break-words max-w-[130px] line-clamp-2">
                                {hasAnswer ? `"${cell.answer}"` : <span className="text-slate-500 italic">No answer</span>}
                              </span>

                              {hasAnswer && (
                                <button
                                  onClick={() => handleToggleCorrect(cell.correct_key)}
                                  className={`mt-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold flex items-center space-x-1 transition shadow-sm ${
                                    cell.is_correct
                                      ? 'bg-emerald-500 text-white hover:bg-emerald-600'
                                      : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 border border-slate-700'
                                  }`}
                                  title="Toggle correctness"
                                >
                                  <Check className="w-3 h-3" />
                                  <span>{cell.is_correct ? 'Correct' : 'Mark'}</span>
                                </button>
                              )}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Leaderboard */}
      {activeTab === 'leaderboard' && (
        <LeaderboardView leaderboard={dashboardData?.leaderboard || []} />
      )}

      {/* Tab 3: Users */}
      {activeTab === 'users' && (
        <div className="bg-slate-800/80 rounded-3xl border border-slate-700/70 overflow-hidden shadow-2xl">
          <div className="px-5 py-4 border-b border-slate-700/60 flex items-center justify-between">
            <h3 className="font-bold text-white text-base">Registered Users</h3>
            <span className="text-xs text-slate-400">{dashboardData?.users.length || 0} total</span>
          </div>

          <div className="divide-y divide-slate-700/40 max-h-[500px] overflow-y-auto">
            {(!dashboardData?.users || dashboardData.users.length === 0) ? (
              <div className="p-8 text-center text-slate-400 text-xs">No users registered yet.</div>
            ) : (
              dashboardData.users.map((u) => (
                <div key={u.user_id} className="p-4 flex items-center justify-between hover:bg-slate-700/30 transition">
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-sm text-white">{u.nickname}</span>
                      {u.is_participant && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                          In Game
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-slate-500 font-mono">ID: {u.user_id}</span>
                  </div>

                  <button
                    onClick={() => handleRemoveUser(u.user_id, u.nickname)}
                    className="p-2 rounded-xl text-rose-400 hover:bg-rose-500/10 transition"
                    title="Remove user"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Tab 4: Game State Info */}
      {activeTab === 'game' && (
        <div className="bg-slate-800/80 rounded-3xl border border-slate-700/70 p-6 shadow-2xl space-y-4">
          <h3 className="font-bold text-white text-base">Game State Overview</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="p-4 rounded-2xl bg-slate-900/50 border border-slate-700/50">
              <span className="text-slate-400">Status</span>
              <p className="text-sm font-bold text-white mt-1">
                {gameState?.is_active ? '🟢 ACTIVE' : '🔴 INACTIVE'}
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-slate-900/50 border border-slate-700/50">
              <span className="text-slate-400">Current Question</span>
              <p className="text-sm font-bold text-white mt-1">
                {gameState?.current_question || 0}
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-slate-900/50 border border-slate-700/50">
              <span className="text-slate-400">Collecting Answers</span>
              <p className="text-sm font-bold text-white mt-1">
                {gameState?.collecting_answers ? 'Yes' : 'No'}
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-slate-900/50 border border-slate-700/50">
              <span className="text-slate-400">Grading Phase</span>
              <p className="text-sm font-bold text-white mt-1">
                {gameState?.grading_phase ? 'Yes' : 'No'}
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-slate-900/50 border border-slate-700/50">
              <span className="text-slate-400">Start Time</span>
              <p className="text-sm font-bold text-white mt-1">
                {gameState?.start_time || 'None'}
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-slate-900/50 border border-slate-700/50">
              <span className="text-slate-400">Started By</span>
              <p className="text-sm font-bold text-white mt-1">
                {gameState?.started_by || 'None'}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
