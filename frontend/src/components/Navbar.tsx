import React from 'react';
import { User, Shield, Flame } from 'lucide-react';

interface NavbarProps {
  currentRole: 'player' | 'admin';
  onRoleChange: (role: 'player' | 'admin') => void;
  nickname: string | null;
  isAdminLoggedIn: boolean;
  onAdminLogout: () => void;
  socketConnected: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentRole,
  onRoleChange,
  isAdminLoggedIn,
  onAdminLogout,
  socketConnected,
}) => {
  return (
    <header className="bg-white/90 dark:bg-[#120b1e]/90 backdrop-blur-md border-b border-orange-200/70 dark:border-purple-900/40 sticky top-0 z-30 shadow-sm safe-top transition-colors">
      <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
        {/* Brand & Connection dot with Jack-o'-lantern theme */}
        <div className="flex items-center space-x-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-orange-600 via-amber-500 to-purple-700 flex items-center justify-center text-white text-lg shadow-md shadow-orange-500/20 transform hover:rotate-6 transition-transform">
            🎃
          </div>
          <div>
            <div className="flex items-center space-x-1.5">
              <span className="font-extrabold text-slate-900 dark:text-orange-100 text-sm sm:text-base leading-tight tracking-wide">
                Spooky Quiz
              </span>
              <span
                className={`w-2 h-2 rounded-full ${
                  socketConnected ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]' : 'bg-orange-500 animate-pulse'
                }`}
                title={socketConnected ? 'Spectral Link Connected' : 'Summoning Connection...'}
              />
            </div>
            <div className="text-[10px] text-orange-600 dark:text-orange-400 font-semibold tracking-wider flex items-center space-x-1">
              <span>HALLOWEEN SPECIAL</span>
              <Flame className="w-2.5 h-2.5 text-orange-500 animate-pulse" />
            </div>
          </div>
        </div>

        {/* View Switcher / Admin Status */}
        <div className="flex items-center space-x-2">
          <div className="flex p-0.5 bg-orange-100/70 dark:bg-purple-950/60 border border-orange-200 dark:border-purple-800/60 rounded-xl">
            <button
              onClick={() => onRoleChange('player')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center space-x-1 ${
                currentRole === 'player'
                  ? 'bg-gradient-to-r from-orange-500 to-amber-600 text-white shadow-sm'
                  : 'text-slate-700 dark:text-purple-300 hover:text-orange-600 dark:hover:text-orange-300'
              }`}
            >
              <User className="w-3.5 h-3.5" />
              <span>Player 👻</span>
            </button>
            <button
              onClick={() => onRoleChange('admin')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center space-x-1 ${
                currentRole === 'admin'
                  ? 'bg-gradient-to-r from-purple-700 to-indigo-700 text-white shadow-sm'
                  : 'text-slate-700 dark:text-purple-300 hover:text-purple-600 dark:hover:text-purple-200'
              }`}
            >
              <Shield className="w-3.5 h-3.5" />
              <span>Host 🧙</span>
            </button>
          </div>

          {currentRole === 'admin' && isAdminLoggedIn && (
            <button
              onClick={onAdminLogout}
              className="text-xs text-rose-600 dark:text-rose-400 hover:text-rose-700 font-medium px-2 py-1 rounded-lg hover:bg-rose-100/50 dark:hover:bg-rose-950/40 transition-all"
            >
              Vanish
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
