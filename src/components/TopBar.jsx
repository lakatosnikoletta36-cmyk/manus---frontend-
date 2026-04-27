import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authLogout } from '@/lib/api';
import { Activity, Folder, LogOut, BarChart3 } from 'lucide-react';

export default function TopBar({ user, active }) {
  const navigate = useNavigate();
  const handleLogout = async () => {
    await authLogout().catch(() => {});
    navigate('/login', { replace: true });
  };

  const linkCls = (key) =>
    `text-[11px] tracking-[0.2em] uppercase px-3 py-1.5 rounded transition-colors ${
      active === key
        ? 'text-cyan-400 bg-cyan-400/10 border border-cyan-400/30'
        : 'text-white/50 hover:text-white border border-transparent'
    }`;

  return (
    <header className="border-b border-white/5 bg-black/30 backdrop-blur-xl sticky top-0 z-40">
      <div className="px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link to="/shell" className="flex items-center gap-2">
            <div className="w-2 h-2 bg-cyan-400 rounded-full pulse-ring" />
            <span className="text-sm tracking-[0.3em] uppercase font-light text-white">MANUS<span className="text-cyan-400">/</span>HÉJ</span>
          </Link>
          <nav className="hidden md:flex items-center gap-2">
            <Link to="/shell" data-testid="nav-shell" className={linkCls('shell')}>
              <Activity className="w-3 h-3 inline mr-1" /> Héj
            </Link>
            <Link to="/ledger" data-testid="nav-ledger" className={linkCls('ledger')}>
              <BarChart3 className="w-3 h-3 inline mr-1" /> Főkönyv
            </Link>
            <Link to="/sandbox" data-testid="nav-sandbox" className={linkCls('sandbox')}>
              <Folder className="w-3 h-3 inline mr-1" /> Homokozó
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-3">
          {user?.picture && (
            <img src={user.picture} alt="" className="w-7 h-7 rounded-full border border-white/20" />
          )}
          <div className="hidden sm:block">
            <div className="text-xs text-white/80 leading-tight">{user?.name}</div>
            <div className="text-[10px] text-white/40 leading-tight">{user?.email}</div>
          </div>
          <button
            data-testid="logout-button"
            onClick={handleLogout}
            className="text-white/40 hover:text-cyan-400 transition-colors p-2 rounded hover:bg-white/5"
            title="Kilépés"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
