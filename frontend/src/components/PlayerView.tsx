import React, { useState, useEffect } from 'react';
import { GameState, LeaderboardEntry } from '../types';
import { api } from '../services/api';
import { LeaderboardView } from './LeaderboardView';
import confetti from 'canvas-confetti';
import {
  Send,
  CheckCircle2,
  Clock,
  Users,
  Trophy,
  AlertCircle,
  Ghost,
  Sparkles,
} from 'lucide-react';

interface PlayerViewProps {
  userId: string | null;
  nickname: string | null;
  onRegistered: (userId: string, nickname: string) => void;
  gameState: GameState;
  leaderboard: LeaderboardEntry[];
  participantCount: number;
  announcement?: string | null;
}

export const PlayerView: React.FC<PlayerViewProps> = ({
  userId,
  nickname,
  onRegistered,
  gameState,
  leaderboard,
  participantCount,
  announcement,
}) => {
  const [inputNickname, setInputNickname] = useState(nickname || '');
  const [isRegistering, setIsRegistering] = useState(false);
  const [regError, setRegError] = useState<string | null>(null);

  const [isParticipant, setIsParticipant] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  const [answerText, setAnswerText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedAnswer, setSubmittedAnswer] = useState<string | null>(null);
  const [answerSuccess, setAnswerSuccess] = useState<string | null>(null);
  const [answerError, setAnswerError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<'game' | 'leaderboard'>('game');

  // Check player status
  useEffect(() => {
    if (userId) {
      api.getPlayerStatus(userId)
        .then((status) => {
          setIsParticipant(status.isParticipant);
          if (status.currentAnswer) {
            setSubmittedAnswer(status.currentAnswer);
          } else {
            setSubmittedAnswer(null);
          }
        })
        .catch(() => {});
    }
  }, [userId, gameState.current_question, gameState.is_active]);

  // Handle nickname registration
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputNickname.trim()) return;
    setIsRegistering(true);
    setRegError(null);
    try {
      const res = await api.register(inputNickname.trim(), userId || undefined);
      onRegistered(res.userId, res.nickname);
      confetti({ particleCount: 50, spread: 60, origin: { y: 0.8 } });
    } catch (err: any) {
      setRegError(err.message || 'Registration failed');
    } finally {
      setIsRegistering(false);
    }
  };

  // Handle joining game
  const handleJoin = async () => {
    if (!userId) return;
    setIsJoining(true);
    setJoinError(null);
    try {
      await api.joinGame(userId);
      setIsParticipant(true);
      confetti({ particleCount: 80, spread: 70, origin: { y: 0.7 } });
    } catch (err: any) {
      setJoinError(err.message || 'Failed to join game');
    } finally {
      setIsJoining(false);
    }
  };

  // Handle answer submission
  const handleSubmitAnswer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId || !answerText.trim() || isSubmitting) return;

    setIsSubmitting(true);
    setAnswerError(null);
    setAnswerSuccess(null);

    try {
      const res = await api.submitAnswer(userId, answerText.trim());
      setSubmittedAnswer(res.answer);
      setAnswerSuccess(`Answer for Question ${res.questionNumber} saved!`);
      setAnswerText('');
      confetti({ particleCount: 40, spread: 50, origin: { y: 0.8 } });
    } catch (err: any) {
      setAnswerError(err.message || 'Failed to submit answer');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-md mx-auto space-y-4">
      {/* Mobile Top Navigation Subtabs */}
      <div className="grid grid-cols-2 gap-1.5 p-1 bg-orange-100/70 dark:bg-purple-950/70 border border-orange-200/60 dark:border-purple-900/60 rounded-xl">
        <button
          onClick={() => setActiveTab('game')}
          className={`py-2 px-3 text-xs sm:text-sm font-semibold rounded-lg transition-all flex items-center justify-center space-x-1.5 ${
            activeTab === 'game'
              ? 'bg-gradient-to-r from-orange-500 to-amber-600 text-white shadow-sm'
              : 'text-slate-700 dark:text-purple-300 hover:text-orange-600 dark:hover:text-orange-300'
          }`}
        >
          <Ghost className="w-4 h-4" />
          <span>Game Session</span>
        </button>

        <button
          onClick={() => setActiveTab('leaderboard')}
          className={`py-2 px-3 text-xs sm:text-sm font-semibold rounded-lg transition-all flex items-center justify-center space-x-1.5 ${
            activeTab === 'leaderboard'
              ? 'bg-gradient-to-r from-purple-700 to-indigo-700 text-white shadow-sm'
              : 'text-slate-700 dark:text-purple-300 hover:text-orange-600 dark:hover:text-orange-300'
          }`}
        >
          <Trophy className="w-4 h-4 text-amber-300" />
          <span>Leaderboard</span>
        </button>
      </div>

      {/* Global Live Announcement */}
      {announcement && (
        <div className="bg-orange-100/90 dark:bg-purple-950/80 border border-orange-300 dark:border-purple-700/80 p-3 rounded-xl flex items-start space-x-2 text-orange-950 dark:text-orange-200 text-xs sm:text-sm shadow-md animate-pulse">
          <Sparkles className="w-4 h-4 shrink-0 text-orange-500 mt-0.5" />
          <span>{announcement}</span>
        </div>
      )}

      {activeTab === 'leaderboard' ? (
        <div className="bg-white/95 dark:bg-[#160f26] p-4 rounded-2xl shadow-md border border-orange-200/80 dark:border-purple-900/50 transition-colors">
          <h2 className="text-base sm:text-lg font-bold text-slate-800 dark:text-orange-200 mb-3 flex items-center space-x-2">
            <Trophy className="w-5 h-5 text-amber-500" />
            <span>Live Standings</span>
          </h2>
          <LeaderboardView leaderboard={leaderboard} currentUserNickname={nickname} />
        </div>
      ) : (
        <div className="space-y-4">
          {/* STEP 1: Registration Card (if not registered) */}
          {!nickname ? (
            <div className="bg-white/95 dark:bg-[#160f26] p-5 rounded-2xl shadow-md border border-orange-200/80 dark:border-purple-900/50 space-y-4 transition-colors">
              <div className="text-center space-x-1">
                <div className="w-14 h-14 bg-gradient-to-tr from-orange-500 to-amber-500 text-white rounded-full flex items-center justify-center mx-auto mb-3 shadow-md shadow-orange-500/30 text-2xl">
                  🎃
                </div>
                <h2 className="text-lg font-extrabold text-slate-900 dark:text-orange-100">Welcome to Quiz Bot! 🎃</h2>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-purple-300 mt-1">
                  Choose a nickname to participate and submit answers.
                </p>
              </div>

              <form onSubmit={handleRegister} className="space-y-3">
                {regError && (
                  <div className="p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs flex items-center space-x-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{regError}</span>
                  </div>
                )}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-orange-300 uppercase tracking-wider mb-1">
                    Your Nickname
                  </label>
                  <input
                    type="text"
                    value={inputNickname}
                    onChange={(e) => setInputNickname(e.target.value)}
                    placeholder="e.g. QuizMaster"
                    maxLength={25}
                    required
                    className="w-full px-3.5 py-2.5 border border-orange-300 dark:border-purple-800/80 bg-white dark:bg-[#1f1535] text-slate-900 dark:text-orange-100 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all text-sm"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isRegistering || !inputNickname.trim()}
                  className="w-full py-3 bg-gradient-to-r from-orange-500 via-amber-600 to-purple-600 hover:from-orange-600 hover:to-purple-700 active:scale-[0.99] text-white font-bold rounded-xl shadow-md shadow-orange-500/20 transition-all text-sm disabled:opacity-50 flex items-center justify-center space-x-2"
                >
                  {isRegistering ? (
                    <Clock className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <span>Register to Play 🎯</span>
                    </>
                  )}
                </button>
              </form>
            </div>
          ) : (
            /* Player Status Banner */
            <div className="bg-white/95 dark:bg-[#160f26] p-3.5 rounded-2xl shadow-md border border-orange-200/80 dark:border-purple-900/50 flex items-center justify-between transition-colors">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-full bg-orange-100 dark:bg-purple-900/60 text-orange-600 dark:text-orange-400 font-extrabold flex items-center justify-center text-sm shadow-inner">
                  🎃
                </div>
                <div>
                  <div className="text-[11px] text-slate-500 dark:text-purple-400 font-medium">Logged in as</div>
                  <div className="text-sm font-bold text-slate-900 dark:text-orange-100">{nickname}</div>
                </div>
              </div>
              <div>
                {isParticipant ? (
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                    In Game
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300">
                    Not in Game
                  </span>
                )}
              </div>
            </div>
          )}

          {/* STEP 2: Game Status & Join Card */}
          <div className="bg-white/95 dark:bg-[#160f26] p-5 rounded-2xl shadow-md border border-orange-200/80 dark:border-purple-900/50 space-y-4 transition-colors">
            <div className="flex items-center justify-between pb-3 border-b border-orange-100 dark:border-purple-900/50">
              <div className="flex items-center space-x-2">
                <span
                  className={`w-2.5 h-2.5 rounded-full ${
                    gameState.is_active ? 'bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.9)] animate-pulse' : 'bg-slate-400'
                  }`}
                />
                <span className="text-xs sm:text-sm font-bold text-slate-800 dark:text-orange-200 uppercase tracking-wide">
                  {gameState.is_active ? 'Game Active' : 'Game Inactive'}
                </span>
              </div>
              <div className="flex items-center space-x-1.5 text-xs text-slate-500 dark:text-purple-300">
                <Users className="w-3.5 h-3.5 text-orange-500" />
                <span>{participantCount} player{participantCount === 1 ? '' : 's'} joined</span>
              </div>
            </div>

            {/* If game is inactive */}
            {!gameState.is_active && (
              <div className="text-center py-6 space-y-2">
                <div className="text-3xl mx-auto">⏳</div>
                <h3 className="text-base font-bold text-slate-800 dark:text-orange-100">Waiting for Host</h3>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-purple-300 max-w-xs mx-auto">
                  The host has not started the game yet. Stay on this screen—it will update automatically!
                </p>
              </div>
            )}

            {/* If game is active but player not joined */}
            {gameState.is_active && nickname && !isParticipant && (
              <div className="space-y-3">
                <div className="p-3 bg-orange-50 dark:bg-purple-950/60 rounded-xl border border-orange-200 dark:border-purple-800/60 text-orange-950 dark:text-orange-200 text-xs sm:text-sm">
                  🎉 A game is in progress! Join in to submit answers and earn points.
                </div>
                {joinError && (
                  <div className="p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs">
                    {joinError}
                  </div>
                )}
                <button
                  onClick={handleJoin}
                  disabled={isJoining}
                  className="w-full py-3 bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 active:scale-[0.99] text-white font-bold rounded-xl shadow-md shadow-orange-500/30 transition-all text-sm disabled:opacity-50 flex items-center justify-center space-x-2"
                >
                  {isJoining ? (
                    <Clock className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <span>Join Game 🎮</span>
                    </>
                  )}
                </button>
              </div>
            )}

            {/* If game active and player joined: Show Question / Answer form */}
            {gameState.is_active && isParticipant && (
              <div className="space-y-4">
                {/* Active Question Box */}
                {gameState.collecting_answers && gameState.current_question > 0 ? (
                  <div className="space-y-3">
                    <div className="bg-gradient-to-br from-orange-600 via-amber-600 to-purple-800 text-white p-4 sm:p-5 rounded-2xl shadow-lg shadow-orange-500/20 text-center relative overflow-hidden">
                      <div className="absolute -top-3 -right-3 text-4xl opacity-30 select-none">🎃</div>
                      <div className="text-xs uppercase tracking-widest font-bold text-orange-200">
                        Current Round
                      </div>
                      <div className="text-3xl font-black mt-0.5 tracking-tight glow-orange">
                        Question #{gameState.current_question}
                      </div>
                      <div className="text-xs text-orange-100/90 mt-1 flex items-center justify-center space-x-1">
                        <span>Answers are currently being collected!</span>
                      </div>
                    </div>

                    {/* Previously submitted answer feedback */}
                    {submittedAnswer && (
                      <div className="p-3 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-300 dark:border-emerald-800 rounded-xl text-emerald-950 dark:text-emerald-200 text-xs sm:text-sm flex items-start space-x-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-semibold">Your submitted answer: </span>
                          <span className="italic font-bold">"{submittedAnswer}"</span>
                          <p className="text-[11px] text-emerald-700 dark:text-emerald-400 mt-0.5">
                            You can type and submit again to update your answer.
                          </p>
                        </div>
                      </div>
                    )}

                    {answerSuccess && (
                      <div className="p-2.5 rounded-lg bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-200 text-xs font-semibold border border-emerald-300 dark:border-emerald-800">
                        {answerSuccess}
                      </div>
                    )}
                    {answerError && (
                      <div className="p-2.5 rounded-lg bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-200 text-xs font-semibold">
                        {answerError}
                      </div>
                    )}

                    {/* Input form */}
                    <form onSubmit={handleSubmitAnswer} className="space-y-2.5">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-orange-300 uppercase tracking-wider mb-1 flex items-center justify-between">
                          <span>Your Answer</span>
                          <span className="text-[10px] text-slate-400 dark:text-purple-400 lowercase">Fuzzy spell-check active</span>
                        </label>
                        <input
                          type="text"
                          value={answerText}
                          onChange={(e) => setAnswerText(e.target.value)}
                          placeholder="Type your answer here..."
                          required
                          className="w-full px-3.5 py-3 border border-orange-300 dark:border-purple-800/80 bg-white dark:bg-[#1f1535] text-slate-900 dark:text-orange-100 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all text-sm shadow-inner"
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={isSubmitting || !answerText.trim()}
                        className="w-full py-3 bg-gradient-to-r from-orange-500 via-amber-600 to-purple-600 hover:from-orange-600 hover:to-purple-700 active:scale-[0.99] text-white font-bold rounded-xl shadow-md shadow-orange-500/20 transition-all text-sm disabled:opacity-50 flex items-center justify-center space-x-2"
                      >
                        {isSubmitting ? (
                          <Clock className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            <Send className="w-4 h-4" />
                            <span>{submittedAnswer ? 'Update Answer' : 'Submit Answer'}</span>
                          </>
                        )}
                      </button>
                    </form>
                  </div>
                ) : gameState.grading_phase ? (
                  <div className="text-center py-6 px-3 bg-purple-50 dark:bg-purple-950/60 border border-purple-200 dark:border-purple-800 rounded-xl space-y-2">
                    <div className="text-3xl">📊</div>
                    <h3 className="text-sm font-bold text-purple-950 dark:text-orange-200">Grading in Progress 📊</h3>
                    <p className="text-xs text-purple-800 dark:text-purple-300">
                      Submissions for this question are closed. The host is reviewing and grading answers.
                    </p>
                  </div>
                ) : (
                  <div className="text-center py-6 px-3 bg-orange-50/60 dark:bg-[#1f1535]/60 border border-orange-200 dark:border-purple-900/60 rounded-xl space-y-2">
                    <div className="text-3xl">⏳</div>
                    <h3 className="text-sm font-bold text-slate-800 dark:text-orange-200">Waiting for Question</h3>
                    <p className="text-xs text-slate-600 dark:text-purple-300">
                      The game is ready. The next question will appear here as soon as the host triggers it!
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
