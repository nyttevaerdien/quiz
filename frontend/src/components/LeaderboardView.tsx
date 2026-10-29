import React from 'react';
import { LeaderboardEntry } from '../types';
import { Trophy } from 'lucide-react';

interface LeaderboardViewProps {
  leaderboard: LeaderboardEntry[];
  currentUserNickname?: string | null;
}

export const LeaderboardView: React.FC<LeaderboardViewProps> = ({
  leaderboard,
  currentUserNickname,
}) => {
  if (leaderboard.length === 0) {
    return (
      <div className="text-center py-12 px-4 bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 transition-colors">
        <Trophy className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
        <h3 className="text-base font-semibold text-slate-700 dark:text-slate-200">No scores recorded yet</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Scores will appear once the host evaluates answers.</p>
      </div>
    );
  }

  const getRankBadge = (rank: number) => {
    switch (rank) {
      case 1:
        return (
          <div className="w-8 h-8 rounded-full bg-amber-500/20 text-amber-500 flex items-center justify-center font-bold text-base shadow-sm ring-2 ring-amber-400">
            👑
          </div>
        );
      case 2:
        return (
          <div className="w-8 h-8 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center font-bold text-base shadow-sm ring-1 ring-purple-400/50">
            🦇
          </div>
        );
      case 3:
        return (
          <div className="w-8 h-8 rounded-full bg-orange-500/20 text-orange-400 flex items-center justify-center font-bold text-base shadow-sm ring-1 ring-orange-400/50">
            🎃
          </div>
        );
      default:
        return (
          <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-purple-950/60 text-slate-600 dark:text-purple-300 flex items-center justify-center font-semibold text-xs border border-slate-200 dark:border-purple-800/40">
            #{rank}
          </div>
        );
    }
  };

  return (
    <div className="space-y-2.5">
      {leaderboard.map((player, index) => {
        const isCurrent = currentUserNickname && player.nickname.toLowerCase() === currentUserNickname.toLowerCase();
        return (
          <div
            key={player.nickname}
            className={`flex items-center justify-between p-3.5 rounded-xl border transition-all ${
              isCurrent
                ? 'bg-orange-50/90 dark:bg-purple-950/70 border-orange-300 dark:border-orange-500/80 shadow-md ring-1 ring-orange-400/50'
                : 'bg-white dark:bg-[#1a122c] border-orange-200/60 dark:border-purple-900/40 hover:border-orange-300 dark:hover:border-purple-700'
            }`}
          >
            <div className="flex items-center space-x-3 min-w-0">
              {getRankBadge(index + 1)}
              <div className="truncate">
                <div className="flex items-center space-x-1.5">
                  <span className="font-bold text-slate-900 dark:text-orange-100 truncate text-sm sm:text-base">
                    {player.nickname}
                  </span>
                  {isCurrent && (
                    <span className="text-[10px] uppercase font-extrabold bg-gradient-to-r from-orange-500 to-amber-500 text-white px-2 py-0.5 rounded-full shadow-xs">
                      You
                    </span>
                  )}
                </div>
                <div className="text-xs text-slate-500 dark:text-purple-300">
                  {player.score} of {player.total_questions} spells solved
                </div>
              </div>
            </div>

            <div className="text-right shrink-0 pl-2">
              <span className="text-base sm:text-lg font-black text-orange-600 dark:text-orange-400 glow-orange">
                {player.percentage}%
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
};
