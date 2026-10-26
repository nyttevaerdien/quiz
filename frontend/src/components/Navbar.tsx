import React from 'react';
import { Shield, User, Wifi, WifiOff } from 'lucide-react';

interface NavbarProps {
  mode: 'player' | 'admin';
  onSwitchMode: (mode: 'player' | 'admin') => void;
  isConnected: boolean;
  playerNickname?: string | null;
  isAdminLoggedIn: boolean;
  onAdminLogout: () => void;
  onChangeNickname: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  mode,
  onSwitchMode,
  isConnected,
  playerNickname,
  isAdminLoggedIn,
  onAdminLogout,
  onChangeNickname,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-slate-800">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center space-x-2">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/20 text-xl font-bold">
            🎯
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-extrabold text-base md:text-lg tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
                Quiz Game
              </span>
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                mode === 'admin' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'
              }`}>
                {mode === 'admin' ? 'Host' : 'Player'}
              </span>
            </div>
            <div className="flex items-center space-x-1.5 text-xs text-slate-400">
              {isConnected ? (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span className="text-emerald-400 font-medium">Live</span>
                </>
              ) : (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                  <span className="text-rose-400 font-medium">Offline</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Right Actions */}
        <div className="flex items-center space-x-2">
          {mode === 'player' && playerNickname && (
            <button
              onClick={onChangeNickname}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-800 border border-slate-700 text-xs font-medium text-slate-300 transition"
              title="Change Nickname"
            >
              <User className="w-3.5 h-3.5 text-indigo-400" />
              <span className="max-w-[100px] truncate font-semibold text-white">{playerNickname}</span>
            </button>
          )}

          {mode === 'admin' && isAdminLoggedIn && (
            <button
              onClick={onAdminLogout}
              className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-medium text-rose-400 transition"
            >
              Logout
            </button>
          )}

          {/* Mode Switcher */}
          <button
            onClick={() => onSwitchMode(mode === 'player' ? 'admin' : 'player')}
            className={`flex items-center space-x-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition shadow-sm ${
              mode === 'player'
                ? 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700'
                : 'bg-indigo-600 text-white hover:bg-indigo-500 shadow-indigo-600/20'
            }`}
          >
            {mode === 'player' ? (
              <>
                <Shield className="w-3.5 h-3.5 text-amber-400" />
                <span>Admin</span>
              </>
            ) : (
              <>
                <User className="w-3.5 h-3.5" />
                <span>Play</span>
              </>
            )}
          </button>
        </div>
      </div>
    </header>
  );
};
