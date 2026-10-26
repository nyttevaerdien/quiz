import React, { useState, useEffect } from 'react';
import { GameState, LeaderboardEntry } from '../types';
import { api } from '../services/api';
import { LeaderboardView } from './LeaderboardView';
import confetti from 'canvas-confetti';
import {
  Send,
  CheckCircle2,
  Clock,
  Sparkles,
  Users,
  Trophy,
  AlertCircle,
  HelpCircle,
  Edit3,
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
  // Local state
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

  // Check player status whenever userId or gameState changes
  useEffect(() => {
    if (userId) {
      api.getPlayerStatus(userId)
        .then(status => {
          setIsParticipant(status.isParticipant);
          if (status.currentAnswer) {
            setSubmittedAnswer(status.currentAnswer);
            setAnswerText(status.currentAnswer);
          }
        })
        .catch(console.error);
    }
  }, [userId, gameState.current_question, gameState.is_active]);

  // Reset submitted answer when question changes
  useEffect(() => {
    if (userId && gameState.current_question > 0) {
      api.getPlayerStatus(userId)
        .then(status => {
          setSubmittedAnswer(status.currentAnswer);
          setAnswerText(status.currentAnswer || '');
          setAnswerSuccess(null);
          setAnswerError(null);
        })
        .catch(() => {});
    }
  }, [gameState.current_question]);

  // Handle Nickname Registration
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputNickname.trim()) return;

    setIsRegistering(true);
    setRegError(null);
    try {
      const res = await api.register(inputNickname.trim(), userId || undefined);
      onRegistered(res.userId, res.nickname);
      confetti({ particleCount: 40, spread: 60, origin: { y: 0.8 } });
    } catch (err: any) {
      setRegError(err.message || 'Error registering');
    } finally {
      setIsRegistering(false);
    }
  };

  // Handle Join Game
  const handleJoin = async () => {
    if (!userId) return;
    setIsJoining(true);
    setJoinError(null);
    try {
      const res = await api.joinGame(userId);
      setIsParticipant(true);
      confetti({ particleCount: 60, spread: 70, origin: { y: 0.7 } });
    } catch (err: any) {
      setJoinError(err.message || 'Could not join game');
    } finally {
      setIsJoining(false);
    }
  };

  // Handle Answer Submit
  const handleAnswerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId || !answerText.trim() || !gameState.collecting_answers) return;

    setIsSubmitting(true);
    setAnswerSuccess(null);
    setAnswerError(null);

    try {
      const res = await api.submitAnswer(userId, answerText.trim());
      setSubmittedAnswer(res.answer);
      setAnswerSuccess(`✅ Answer recorded for Question ${res.questionNumber}!`);
      confetti({ particleCount: 30, spread: 50, origin: { y: 0.6 } });
    } catch (err: any) {
      setAnswerError(err.message || 'Failed to submit answer');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 1. If not registered, show Registration screen
  if (!userId || !nickname) {
    return (
      <div className="max-w-md mx-auto px-4 py-8">
        <div className="bg-slate-800/80 backdrop-blur-xl border border-slate-700/80 rounded-3xl p-6 sm:p-8 shadow-2xl text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-3xl shadow-lg shadow-indigo-500/30">
            🎯
          </div>

          <h2 className="text-2xl font-extrabold text-white tracking-tight">
            Welcome to Quiz Bot!
          </h2>
          <p className="text-slate-400 text-sm mt-1 mb-6">
            Enter your nickname to join the game from your mobile browser.
          </p>

          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 text-left mb-1.5 ml-1">
                Your Nickname
              </label>
              <input
                type="text"
                value={inputNickname}
                onChange={(e) => setInputNickname(e.target.value)}
                placeholder="e.g. Alex, CyberNinja..."
                maxLength={25}
                required
                className="w-full px-4 py-3.5 bg-slate-900/90 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-medium transition text-base"
              />
            </div>

            {regError && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-xs flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{regError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isRegistering || !inputNickname.trim()}
              className="w-full py-3.5 px-4 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 disabled:opacity-50 text-white font-bold rounded-xl shadow-lg shadow-indigo-600/30 transition transform active:scale-98 flex items-center justify-center space-x-2 text-base"
            >
              {isRegistering ? (
                <span>Registering...</span>
              ) : (
                <>
                  <span>Start Playing</span>
                  <Sparkles className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-slate-700/60 text-xs text-slate-400 flex items-center justify-center space-x-1.5">
            <HelpCircle className="w-3.5 h-3.5 text-indigo-400" />
            <span>Fully compatible with Telegram Bot players</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto px-4 py-4 space-y-4 pb-20">
      {/* Announcement Banner */}
      {announcement && (
        <div className="p-3 bg-indigo-500/15 border border-indigo-500/30 rounded-2xl text-indigo-200 text-xs flex items-center space-x-2 shadow-lg animate-bounce">
          <Sparkles className="w-4 h-4 text-indigo-400 shrink-0" />
          <span className="font-medium">{announcement}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex bg-slate-800/80 p-1 rounded-2xl border border-slate-700/60">
        <button
          onClick={() => setActiveTab('game')}
          className={`flex-1 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center space-x-1.5 ${
            activeTab === 'game'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <span>Game Screen</span>
        </button>
        <button
          onClick={() => setActiveTab('leaderboard')}
          className={`flex-1 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center space-x-1.5 ${
            activeTab === 'leaderboard'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Trophy className="w-3.5 h-3.5 text-amber-400" />
          <span>Leaderboard</span>
        </button>
      </div>

      {activeTab === 'leaderboard' ? (
        <LeaderboardView leaderboard={leaderboard} currentNickname={nickname} />
      ) : (
        <>
          {/* Main Game Screen */}

          {/* 1. If Game is Inactive */}
          {!gameState.is_active && (
            <div className="bg-slate-800/70 border border-slate-700/60 rounded-3xl p-6 sm:p-8 text-center shadow-xl backdrop-blur-sm">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center text-3xl">
                ⏳
              </div>
              <div className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20 mb-3">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-400 mr-2"></span>
                No Active Game
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Waiting for Host...</h3>
              <p className="text-slate-400 text-xs sm:text-sm max-w-xs mx-auto leading-relaxed">
                The game host hasn't started a session yet. Keep this screen open; you'll be notified automatically the moment the game goes live!
              </p>

              <div className="mt-6 pt-6 border-t border-slate-700/50 flex items-center justify-between text-xs text-slate-400">
                <span>Player: <strong className="text-white">{nickname}</strong></span>
                <span className="text-emerald-400 font-medium">Ready to join</span>
              </div>
            </div>
          )}

          {/* 2. If Game is Active, but Player hasn't joined */}
          {gameState.is_active && !isParticipant && (
            <div className="bg-slate-800/80 border border-emerald-500/40 rounded-3xl p-6 sm:p-8 text-center shadow-2xl backdrop-blur-md relative overflow-hidden">
              <div className="absolute -top-12 -right-12 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl"></div>

              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-3xl shadow-lg shadow-emerald-500/10">
                🎮
              </div>

              <div className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 mb-3">
                <span className="w-2 h-2 rounded-full bg-emerald-400 mr-2 animate-ping"></span>
                Game is Active!
              </div>

              <h3 className="text-xl font-extrabold text-white mb-2">Ready to Play?</h3>
              <p className="text-slate-300 text-xs sm:text-sm mb-6 max-w-xs mx-auto">
                A game is in progress! Join now to answer questions and compete for the leaderboard.
              </p>

              {joinError && (
                <div className="p-3 mb-4 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-xs text-left">
                  {joinError}
                </div>
              )}

              <button
                onClick={handleJoin}
                disabled={isJoining}
                className="w-full py-4 px-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold rounded-2xl shadow-xl shadow-emerald-600/30 transition transform active:scale-98 text-base flex items-center justify-center space-x-2"
              >
                {isJoining ? (
                  <span>Joining...</span>
                ) : (
                  <>
                    <span>Join Game Now</span>
                    <Sparkles className="w-5 h-5" />
                  </>
                )}
              </button>

              <div className="mt-4 flex items-center justify-center space-x-1.5 text-xs text-slate-400">
                <Users className="w-3.5 h-3.5 text-slate-400" />
                <span>{participantCount} {participantCount === 1 ? 'player' : 'players'} already joined</span>
              </div>
            </div>
          )}

          {/* 3. If Game is Active and Player has joined! */}
          {gameState.is_active && isParticipant && (
            <div className="space-y-4">
              {/* Joined Status Header */}
              <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-4 flex items-center justify-between shadow-lg">
                <div className="flex items-center space-x-2.5">
                  <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">In Game</h4>
                    <p className="text-xs text-slate-400 font-medium">{nickname}</p>
                  </div>
                </div>

                <div className="flex items-center space-x-1.5 text-xs px-2.5 py-1 rounded-lg bg-slate-900/60 border border-slate-700/60 text-slate-300">
                  <Users className="w-3.5 h-3.5 text-indigo-400" />
                  <span className="font-bold">{participantCount}</span>
                  <span className="text-slate-400">players</span>
                </div>
              </div>

              {/* Question Screen */}
              {gameState.current_question === 0 ? (
                /* Waiting for Question 1 */
                <div className="bg-slate-800/70 border border-slate-700/60 rounded-3xl p-8 text-center shadow-xl">
                  <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-2xl">
                    ⏳
                  </div>
                  <h3 className="text-lg font-bold text-white mb-1">Get Ready!</h3>
                  <p className="text-xs text-slate-400 max-w-xs mx-auto">
                    You are in the game! The host will start Question 1 shortly. Answer as fast and accurately as you can.
                  </p>
                </div>
              ) : (
                /* Active Question */
                <div className="bg-slate-800/90 border border-slate-700 rounded-3xl p-5 sm:p-6 shadow-2xl backdrop-blur-md">
                  {/* Question Header */}
                  <div className="flex items-center justify-between pb-4 border-b border-slate-700/60">
                    <div>
                      <span className="text-[10px] font-extrabold uppercase tracking-widest text-indigo-400">
                        Active Round
                      </span>
                      <h2 className="text-2xl font-black text-white tracking-tight">
                        Question #{gameState.current_question}
                      </h2>
                    </div>

                    <div>
                      {gameState.collecting_answers ? (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 animate-pulse">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1.5"></span>
                          Accepting Answers
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                          <Clock className="w-3.5 h-3.5 mr-1 text-amber-400" />
                          Grading Phase
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Submission Form / Status */}
                  <div className="mt-5 space-y-4">
                    {submittedAnswer && (
                      <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl">
                        <div className="flex items-center justify-between text-xs font-semibold text-emerald-400 mb-1">
                          <span className="flex items-center space-x-1">
                            <CheckCircle2 className="w-4 h-4" />
                            <span>Your Answer Recorded</span>
                          </span>
                          {gameState.collecting_answers && (
                            <span className="text-[11px] text-slate-400 flex items-center space-x-1">
                              <Edit3 className="w-3 h-3" />
                              <span>You can edit below</span>
                            </span>
                          )}
                        </div>
                        <p className="text-base font-bold text-white break-words mt-1">
                          "{submittedAnswer}"
                        </p>
                      </div>
                    )}

                    {answerSuccess && (
                      <div className="p-3 bg-indigo-500/15 border border-indigo-500/30 rounded-xl text-indigo-300 text-xs font-medium">
                        {answerSuccess}
                      </div>
                    )}

                    {answerError && (
                      <div className="p-3 bg-rose-500/15 border border-rose-500/30 rounded-xl text-rose-300 text-xs font-medium">
                        {answerError}
                      </div>
                    )}

                    {gameState.collecting_answers ? (
                      <form onSubmit={handleAnswerSubmit} className="space-y-3">
                        <div>
                          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1 ml-1">
                            {submittedAnswer ? 'Change your answer:' : 'Enter your answer:'}
                          </label>
                          <textarea
                            rows={3}
                            value={answerText}
                            onChange={(e) => setAnswerText(e.target.value)}
                            placeholder="Type your answer here..."
                            required
                            className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-2xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-base resize-none"
                          />
                        </div>

                        <button
                          type="submit"
                          disabled={isSubmitting || !answerText.trim()}
                          className="w-full py-3.5 px-4 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 disabled:opacity-50 text-white font-bold rounded-2xl shadow-lg shadow-indigo-600/30 transition transform active:scale-98 flex items-center justify-center space-x-2 text-base"
                        >
                          <Send className="w-4 h-4" />
                          <span>{isSubmitting ? 'Submitting...' : submittedAnswer ? 'Update Answer' : 'Submit Answer'}</span>
                        </button>
                      </form>
                    ) : (
                      <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-center space-y-1">
                        <p className="text-sm font-bold text-amber-300">
                          Answers are now locked for Question #{gameState.current_question}.
                        </p>
                        <p className="text-xs text-slate-400">
                          The host is reviewing everyone's answers. Stay tuned for the score update and next question!
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};
