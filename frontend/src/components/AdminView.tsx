import React, { useState } from 'react';
import { DashboardData } from '../types';
import { api } from '../services/api';
import { LeaderboardView } from './LeaderboardView';
import {
  Play,
  SkipForward,
  CheckCircle,
  Square,
  RefreshCw,
  Trash2,
  AlertCircle,
  Shield,
  KeyRound,
  Plus,
  Pencil,
  Check,
  X,
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

  const [activeTab, setActiveTab] = useState<'game' | 'keys' | 'answers' | 'leaderboard' | 'users'>('game');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // New Answer Key state
  const [newKeyQuestion, setNewKeyQuestion] = useState<number>(1);
  const [newKeyAnswer, setNewKeyAnswer] = useState<string>('');
  const [isSavingKey, setIsSavingKey] = useState<boolean>(false);

  // In-line editing state for existing answer keys
  const [editingQuestion, setEditingQuestion] = useState<number | null>(null);
  const [editingValue, setEditingValue] = useState<string>('');

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

  const handleStartGame = async () => {
    if (!window.confirm('Start a new game? This will reset all current answers and participants.')) return;
    setActionLoading('start');
    try {
      await api.startGame();
      showFeedback('🎮 Game started! Participants reset and Telegram broadcast sent.');
      onRefreshDashboard();
    } catch (err: any) {
      showFeedback(err.message, 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleEndGame = async () => {
    if (!window.confirm('Are you sure you want to end the current game?')) return;
    setActionLoading('end');
    try {
      await api.endGame();
      showFeedback('🏁 Game ended successfully.');
      onRefreshDashboard();
    } catch (err: any) {
      showFeedback(err.message, 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleNextQuestion = async () => {
    setActionLoading('next');
    try {
      const res = await api.nextQuestion();
      showFeedback(`📝 Question ${res.current_question} is now open for answers!`);
      onRefreshDashboard();
    } catch (err: any) {
      showFeedback(err.message, 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleStartGrading = async () => {
    setActionLoading('grade');
    try {
      await api.startGrading();
      showFeedback('📊 Grading phase started! Submissions closed.');
      onRefreshDashboard();
    } catch (err: any) {
      showFeedback(err.message, 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleToggleCorrect = async (correctKey: string) => {
    try {
      await api.toggleCorrect(correctKey);
      onRefreshDashboard();
    } catch (err: any) {
      showFeedback(err.message || 'Failed to toggle status', 'error');
    }
  };

  const handleRemoveUser = async (userId: string, nickname: string) => {
    if (!window.confirm(`Are you sure you want to remove ${nickname}? All their answers and records will be deleted.`)) return;
    try {
      await api.removeUser(userId);
      showFeedback(`User ${nickname} removed`);
      onRefreshDashboard();
    } catch (err: any) {
      showFeedback(err.message || 'Failed to remove user', 'error');
    }
  };

  const handleSaveAnswerKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyAnswer.trim() || !newKeyQuestion || newKeyQuestion <= 0) return;
    setIsSavingKey(true);
    try {
      await api.setAnswerKey(newKeyQuestion, newKeyAnswer.trim());
      showFeedback(`✅ Correct answer for Q${newKeyQuestion} saved! Incoming and existing answers are evaluated automatically.`);
      setNewKeyAnswer('');
      setNewKeyQuestion((prev) => prev + 1);
      onRefreshDashboard();
    } catch (err: any) {
      showFeedback(err.message || 'Failed to save answer key', 'error');
    } finally {
      setIsSavingKey(false);
    }
  };

  const handleDeleteAnswerKey = async (qNum: number) => {
    if (!window.confirm(`Remove answer key for Question ${qNum}?`)) return;
    try {
      await api.deleteAnswerKey(qNum);
      showFeedback(`Answer key for Q${qNum} removed`);
      onRefreshDashboard();
    } catch (err: any) {
      showFeedback(err.message || 'Failed to delete answer key', 'error');
    }
  };

  const startEditKey = (qNum: number, currentAnswer: string) => {
    setEditingQuestion(qNum);
    setEditingValue(currentAnswer);
  };

  const cancelEditKey = () => {
    setEditingQuestion(null);
    setEditingValue('');
  };

  const handleUpdateAnswerKey = async (qNum: number) => {
    if (!editingValue.trim()) return;
    try {
      await api.setAnswerKey(qNum, editingValue.trim());
      showFeedback(`✅ Correct answer for Q${qNum} updated to "${editingValue.trim()}"! Player scores re-evaluated.`);
      setEditingQuestion(null);
      setEditingValue('');
      onRefreshDashboard();
    } catch (err: any) {
      showFeedback(err.message || 'Failed to update answer key', 'error');
    }
  };

  // If not logged in, render login form
  if (!isLoggedIn) {
    return (
      <div className="max-w-sm mx-auto my-8 bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 transition-colors">
        <div className="text-center mb-5">
          <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 rounded-full flex items-center justify-center mx-auto mb-3">
            <Shield className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Admin Authentication</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Enter your admin password to control quiz sessions.</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-3">
          {loginError && (
            <div className="p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{loginError}</span>
            </div>
          )}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
              Admin Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Default: admin"
              required
              className="w-full px-3.5 py-2.5 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={isLoggingIn || !password}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl shadow-md transition-all text-sm disabled:opacity-50 flex items-center justify-center space-x-2"
          >
            {isLoggingIn ? <RefreshCw className="w-4 h-4 animate-spin" /> : <span>Login to Dashboard</span>}
          </button>
        </form>
      </div>
    );
  }

  const gameState = dashboardData?.game_state || {
    is_active: false,
    started_by: null,
    start_time: null,
    current_question: 0,
    collecting_answers: false,
    grading_phase: false,
  };

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      {/* Top Banner & Refresh */}
      <div className="flex items-center justify-between bg-white/95 dark:bg-[#160f26] p-3.5 rounded-2xl shadow-md border border-orange-200/80 dark:border-purple-900/50 transition-colors">
        <div className="flex items-center space-x-2">
          <Shield className="w-5 h-5 text-purple-600 dark:text-purple-400" />
          <span className="font-extrabold text-slate-900 dark:text-orange-100 text-sm sm:text-base">Witch Host Coven</span>
        </div>
        <button
          onClick={onRefreshDashboard}
          className="p-2 text-slate-500 dark:text-purple-300 hover:text-orange-600 dark:hover:text-orange-300 rounded-lg hover:bg-orange-50 dark:hover:bg-purple-950/60 transition-all text-xs flex items-center space-x-1"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Refresh Sight</span>
        </button>
      </div>

      {/* Feedback Toast */}
      {feedback && (
        <div
          className={`p-3 rounded-xl text-xs sm:text-sm font-medium ${
            feedback.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800'
              : 'bg-rose-50 dark:bg-rose-950/60 text-rose-800 dark:text-rose-200 border border-rose-200 dark:border-rose-800'
          }`}
        >
          {feedback.message}
        </div>
      )}

      {/* Tabs navigation */}
      <div className="grid grid-cols-5 gap-1 p-1 bg-slate-200/70 dark:bg-slate-800 rounded-xl">
        <button
          onClick={() => setActiveTab('game')}
          className={`py-2 px-1 text-[11px] sm:text-xs font-semibold rounded-lg transition-all text-center ${
            activeTab === 'game' ? 'bg-white dark:bg-slate-700 text-indigo-700 dark:text-indigo-300 shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          🎮 Game
        </button>
        <button
          onClick={() => setActiveTab('keys')}
          className={`py-2 px-1 text-[11px] sm:text-xs font-semibold rounded-lg transition-all text-center ${
            activeTab === 'keys' ? 'bg-white dark:bg-slate-700 text-indigo-700 dark:text-indigo-300 shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          🔑 Keys
        </button>
        <button
          onClick={() => setActiveTab('answers')}
          className={`py-2 px-1 text-[11px] sm:text-xs font-semibold rounded-lg transition-all text-center ${
            activeTab === 'answers' ? 'bg-white dark:bg-slate-700 text-indigo-700 dark:text-indigo-300 shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          📝 Answers
        </button>
        <button
          onClick={() => setActiveTab('leaderboard')}
          className={`py-2 px-1 text-[11px] sm:text-xs font-semibold rounded-lg transition-all text-center ${
            activeTab === 'leaderboard' ? 'bg-white dark:bg-slate-700 text-indigo-700 dark:text-indigo-300 shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          🏆 Scores
        </button>
        <button
          onClick={() => setActiveTab('users')}
          className={`py-2 px-1 text-[11px] sm:text-xs font-semibold rounded-lg transition-all text-center ${
            activeTab === 'users' ? 'bg-white dark:bg-slate-700 text-indigo-700 dark:text-indigo-300 shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          👥 Users
        </button>
      </div>

      {/* TAB 1: GAME CONTROLS */}
      {activeTab === 'game' && (
        <div className="space-y-4">
          {/* Status Metrics Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm text-center transition-colors">
              <div className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase">Status</div>
              <div className={`text-base sm:text-lg font-bold mt-1 ${gameState.is_active ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                {gameState.is_active ? '🟢 ACTIVE' : '🔴 INACTIVE'}
              </div>
            </div>
            <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm text-center transition-colors">
              <div className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase">Current Question</div>
              <div className="text-base sm:text-lg font-bold text-slate-800 dark:text-slate-100 mt-1">
                {gameState.current_question || 'None'}
              </div>
            </div>
            <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm text-center transition-colors">
              <div className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase">Participants</div>
              <div className="text-base sm:text-lg font-bold text-indigo-600 dark:text-indigo-400 mt-1">
                {dashboardData?.player_count ?? dashboardData?.table_data?.length ?? 0}
              </div>
            </div>
            <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm text-center transition-colors">
              <div className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase">Total Questions</div>
              <div className="text-base sm:text-lg font-bold text-slate-800 dark:text-slate-100 mt-1">
                {dashboardData?.question_count ?? 0}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 space-y-3 transition-colors">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider mb-2">Game Operations</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {!gameState.is_active ? (
                <button
                  onClick={handleStartGame}
                  disabled={actionLoading === 'start'}
                  className="py-3 px-4 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white font-semibold rounded-xl text-sm flex items-center justify-center space-x-2 shadow-sm transition-all"
                >
                  <Play className="w-4 h-4" />
                  <span>Start New Game</span>
                </button>
              ) : (
                <button
                  onClick={handleEndGame}
                  disabled={actionLoading === 'end'}
                  className="py-3 px-4 bg-rose-600 hover:bg-rose-700 active:scale-[0.99] text-white font-semibold rounded-xl text-sm flex items-center justify-center space-x-2 shadow-sm transition-all"
                >
                  <Square className="w-4 h-4" />
                  <span>End Current Game</span>
                </button>
              )}

              {gameState.is_active && !gameState.grading_phase && (
                <button
                  onClick={handleNextQuestion}
                  disabled={actionLoading === 'next'}
                  className="py-3 px-4 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] text-white font-semibold rounded-xl text-sm flex items-center justify-center space-x-2 shadow-sm transition-all"
                >
                  <SkipForward className="w-4 h-4" />
                  <span>Next Question (Q{(gameState.current_question || 0) + 1})</span>
                </button>
              )}

              {gameState.is_active && !gameState.grading_phase && (
                <button
                  onClick={handleStartGrading}
                  disabled={actionLoading === 'grade'}
                  className="py-3 px-4 bg-amber-500 hover:bg-amber-600 active:scale-[0.99] text-white font-semibold rounded-xl text-sm flex items-center justify-center space-x-2 shadow-sm transition-all"
                >
                  <CheckCircle className="w-4 h-4" />
                  <span>Start Grading Answers</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB: ANSWER KEYS (PREDEFINED AUTO-CHECK) */}
      {activeTab === 'keys' && (
        <div className="space-y-4">
          {/* Add / Edit Answer Key Form */}
          <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 space-y-4 transition-colors">
            <div className="flex items-center space-x-2">
              <KeyRound className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              <div>
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider">
                  Predefine Correct Answers
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Enter correct answers prior to or during the game. All incoming player answers will be automatically checked and scored instantly.
                </p>
              </div>
            </div>

            <form onSubmit={handleSaveAnswerKey} className="flex flex-col sm:flex-row gap-2.5">
              <div className="w-full sm:w-32">
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">
                  Question #
                </label>
                <input
                  type="number"
                  min="1"
                  value={newKeyQuestion}
                  onChange={(e) => setNewKeyQuestion(parseInt(e.target.value, 10) || 1)}
                  required
                  className="w-full px-3 py-2.5 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-bold"
                />
              </div>

              <div className="flex-1">
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">
                  Correct Answer Key
                </label>
                <input
                  type="text"
                  value={newKeyAnswer}
                  onChange={(e) => setNewKeyAnswer(e.target.value)}
                  placeholder="e.g. Paris, 1984, Oxygen"
                  required
                  className="w-full px-3.5 py-2.5 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                />
              </div>

              <div className="flex items-end">
                <button
                  type="submit"
                  disabled={isSavingKey || !newKeyAnswer.trim()}
                  className="w-full sm:w-auto py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] text-white font-semibold rounded-xl text-sm flex items-center justify-center space-x-1.5 shadow-sm transition-all disabled:opacity-50"
                >
                  <Plus className="w-4 h-4" />
                  <span>Save Answer Key</span>
                </button>
              </div>
            </form>
          </div>

          {/* Current Answer Keys List */}
          <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 space-y-3 transition-colors">
            <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              Configured Answer Keys
            </h4>

            {(!dashboardData?.answer_keys || Object.keys(dashboardData.answer_keys).length === 0) ? (
              <div className="text-center py-8 text-slate-400 dark:text-slate-500 text-xs sm:text-sm">
                No answer keys added yet. Add answers above to enable automated answer validation.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                {Object.entries(dashboardData.answer_keys)
                  .sort(([a], [b]) => parseInt(a, 10) - parseInt(b, 10))
                  .map(([qStr, answer]) => {
                    const qNum = parseInt(qStr, 10);
                    const isEditing = editingQuestion === qNum;

                    return (
                      <div
                        key={qNum}
                        className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50 space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                            Question {qNum}
                          </span>
                          {!isEditing && (
                            <div className="flex items-center space-x-1">
                              <button
                                onClick={() => startEditKey(qNum, answer)}
                                className="p-1 text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 hover:bg-slate-200 dark:hover:bg-slate-700/60 rounded-md transition-all"
                                title="Edit this answer key"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteAnswerKey(qNum)}
                                className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-md transition-all"
                                title="Remove this answer key"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </div>

                        {isEditing ? (
                          <div className="space-y-1.5 pt-1">
                            <input
                              type="text"
                              value={editingValue}
                              onChange={(e) => setEditingValue(e.target.value)}
                              placeholder="New correct answer..."
                              autoFocus
                              className="w-full px-2.5 py-1.5 border border-indigo-400 dark:border-indigo-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-lg text-xs outline-none focus:ring-1 focus:ring-indigo-500"
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleUpdateAnswerKey(qNum);
                                if (e.key === 'Escape') cancelEditKey();
                              }}
                            />
                            <div className="flex items-center justify-end space-x-1.5">
                              <button
                                onClick={cancelEditKey}
                                className="px-2 py-1 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-xs flex items-center space-x-0.5"
                              >
                                <X className="w-3 h-3" />
                                <span>Cancel</span>
                              </button>
                              <button
                                onClick={() => handleUpdateAnswerKey(qNum)}
                                disabled={!editingValue.trim()}
                                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-semibold flex items-center space-x-0.5 disabled:opacity-50"
                              >
                                <Check className="w-3 h-3" />
                                <span>Save</span>
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="text-sm font-semibold text-slate-800 dark:text-slate-100 break-words">
                            "{answer}"
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: ANSWERS & GRADING MATRIX */}
      {activeTab === 'answers' && (
        <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 space-y-3 transition-colors">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider">
              Answers & Verification Matrix
            </h3>
            <span className="text-xs text-slate-500 dark:text-slate-400">Tap checkboxes to mark answers as correct</span>
          </div>

          {(!dashboardData?.table_data || dashboardData.table_data.length === 0) ? (
            <div className="text-center py-10 text-slate-400 dark:text-slate-500 text-xs sm:text-sm">
              No participants have joined this game yet.
            </div>
          ) : (
            <div className="overflow-x-auto -mx-4 sm:mx-0">
              <table className="w-full text-left border-collapse text-xs sm:text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/60">
                    <th className="p-3 font-semibold text-slate-700 dark:text-slate-300">Player</th>
                    {dashboardData.questions.map((q) => (
                      <th key={q} className="p-3 font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap text-center">
                        Q{q.split('_')[1]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {dashboardData.table_data.map((row) => (
                    <tr key={row.user_id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                      <td className="p-3 font-medium text-slate-900 dark:text-slate-100 whitespace-nowrap">
                        {row.player}
                      </td>
                      {dashboardData.questions.map((q) => {
                        const qNum = q.split('_')[1];
                        const cell = row[`q${qNum}`];
                        if (!cell) return <td key={q} className="p-3 text-center text-slate-300 dark:text-slate-600">-</td>;

                        return (
                          <td
                            key={q}
                            className={`p-3 text-center transition-all ${
                              cell.is_correct ? 'bg-emerald-50/90 dark:bg-emerald-950/70 text-emerald-900 dark:text-emerald-200 font-medium' : ''
                            }`}
                          >
                            <div className="flex flex-col items-center justify-center space-y-1">
                              <span className="text-xs text-slate-800 dark:text-slate-200">{cell.answer || <span className="text-slate-300 dark:text-slate-600 italic">No answer</span>}</span>
                              {cell.answer && (
                                <input
                                  type="checkbox"
                                  checked={cell.is_correct}
                                  onChange={() => handleToggleCorrect(cell.correct_key)}
                                  className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                                />
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

      {/* TAB 3: LEADERBOARD */}
      {activeTab === 'leaderboard' && (
        <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 transition-colors">
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider mb-3">Live Standings</h3>
          <LeaderboardView leaderboard={dashboardData?.leaderboard || []} />
        </div>
      )}

      {/* TAB 4: USERS MANAGEMENT */}
      {activeTab === 'users' && (
        <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 space-y-3 transition-colors">
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider">Registered Users</h3>
          <div className="overflow-x-auto -mx-4 sm:mx-0">
            <table className="w-full text-left border-collapse text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60">
                  <th className="p-3 font-semibold text-slate-700 dark:text-slate-300">User ID</th>
                  <th className="p-3 font-semibold text-slate-700 dark:text-slate-300">Nickname</th>
                  <th className="p-3 font-semibold text-slate-700 dark:text-slate-300">Status</th>
                  <th className="p-3 font-semibold text-slate-700 dark:text-slate-300 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {(dashboardData?.users || []).map((u) => (
                  <tr key={u.user_id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="p-3 font-mono text-slate-500 dark:text-slate-400 text-xs">{u.user_id}</td>
                    <td className="p-3 font-medium text-slate-800 dark:text-slate-100">{u.nickname}</td>
                    <td className="p-3">
                      {u.is_participant ? (
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300">
                          Active Participant
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                          Inactive
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-right">
                      <button
                        onClick={() => handleRemoveUser(u.user_id, u.nickname)}
                        className="p-1.5 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-all"
                        title="Remove user and all their records"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
