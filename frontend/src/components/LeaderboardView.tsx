import React from 'react';
import { LeaderboardEntry } from '../types';
import { Trophy, Award, TrendingUp } from 'lucide-react';

interface LeaderboardProps {
  leaderboard: LeaderboardEntry[];
  currentNickname?: string | null;
  className?: string;
}

export const LeaderboardView: React.FC<LeaderboardProps> = ({
  leaderboard,
  currentNickname,
  className = '',
}) => {
  if (!leaderboard || leaderboard.length === 0) {
    return (
      <div className={`bg-slate-800/50 rounded-2xl border border-slate-700/60 p-8 text-center ${className}`}>
        <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-slate-800 flex items-center justify-center text-slate-400">
          <Trophy className="w-6 h-6" />
        </div>
        <h4 className="font-semibold text-slate-200">No scores yet</h4>
        <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
          Scores will appear here as the host reviews and grades questions!
        </p>
      </div>
    );
  }

  const getRankBadge = (rank: number) => {
    if (rank === 1) {
      return (
        <span className="w-7 h-7 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center justify-center font-bold text-xs shadow-sm">
          🥇
        </span>
      );
    }
    if (rank === 2) {
      return (
        <span className="w-7 h-7 rounded-full bg-slate-300/20 text-slate-200 border border-slate-300/40 flex items-center justify-center font-bold text-xs shadow-sm">
          🥈
        </span>
      );
    }
    if (rank === 3) {
      return (
        <span className="w-7 h-7 rounded-full bg-amber-700/20 text-amber-600 border border-amber-700/40 flex items-center justify-center font-bold text-xs shadow-sm">
          🥉
        </span>
      );
    }
    return (
      <span className="w-7 h-7 rounded-full bg-slate-800 text-slate-400 flex items-center justify-center font-semibold text-xs border border-slate-700">
        #{rank}
      </span>
    );
  };

  return (
    <div className={`bg-slate-800/60 rounded-2xl border border-slate-700/60 shadow-xl overflow-hidden backdrop-blur-sm ${className}`}>
      <div className="px-5 py-4 border-b border-slate-700/60 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Trophy className="w-5 h-5 text-amber-400" />
          <h3 className="font-bold text-base text-white tracking-tight">Leaderboard</h3>
        </div>
        <span className="text-xs text-slate-400 font-medium">
          {leaderboard.length} {leaderboard.length === 1 ? 'player' : 'players'}
        </span>
      </div>

      <div className="divide-y divide-slate-800/80 max-h-[460px] overflow-y-auto">
        {leaderboard.map((item, idx) => {
          const rank = idx + 1;
          const isCurrentUser = currentNickname && item.nickname.toLowerCase() === currentNickname.toLowerCase();

          return (
            <div
              key={item.nickname}
              className={`px-4 py-3.5 flex items-center justify-between transition ${
                isCurrentUser
                  ? 'bg-indigo-950/40 border-l-4 border-indigo-500'
                  : 'hover:bg-slate-800/40'
              }`}
            >
              <div className="flex items-center space-x-3 min-w-0">
                {getRankBadge(rank)}
                <div className="min-w-0">
                  <div className="flex items-center space-x-1.5">
                    <p className={`text-sm font-bold truncate ${isCurrentUser ? 'text-indigo-300' : 'text-slate-100'}`}>
                      {item.nickname}
                    </p>
                    {isCurrentUser && (
                      <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                        You
                      </span>
                    )}
                  </div>
                  <div className="flex items-center space-x-2 mt-0.5">
                    <div className="w-24 bg-slate-700/60 h-1.5 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          rank === 1 ? 'bg-amber-400' : isCurrentUser ? 'bg-indigo-500' : 'bg-slate-400'
                        }`}
                        style={{ width: `${Math.min(100, item.percentage || 0)}%` }}
                      />
                    </div>
                    <span className="text-[11px] text-slate-400">{item.percentage}%</span>
                  </div>
                </div>
              </div>

              <div className="text-right pl-3 shrink-0">
                <div className="text-base font-extrabold text-white">
                  {item.score}
                  <span className="text-xs text-slate-400 font-normal"> / {item.total_questions}</span>
                </div>
                <span className="text-[10px] text-slate-400 font-medium">points</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
