import React, { useEffect, useState, useCallback } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import Login from '@/pages/Login';
import Shell from '@/pages/Shell';
import Ledger from '@/pages/Ledger';
import Sandbox from '@/pages/Sandbox';
import { authMe, authGoogle } from '@/lib/api';
import './App.css';

function AuthCallback() {
  const navigate = useNavigate();
  const ranRef = React.useRef(false);

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;
    const hash = window.location.hash;
    const m = hash.match(/session_id=([^&]+)/);
    if (!m) {
      navigate('/login');
      return;
    }
    authGoogle(m[1])
      .then((data) => {
        window.history.replaceState(null, '', '/shell');
        navigate('/shell', { state: { user: data.user }, replace: true });
      })
      .catch(() => navigate('/login', { replace: true }));
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#030305] text-cyan-400 font-mono">
      <div className="text-center space-y-3">
        <div className="text-xs tracking-[0.3em] uppercase opacity-70">Kapcsolat létrehozása</div>
        <div className="text-2xl text-glow blink-cursor">Hitelesítés</div>
      </div>
    </div>
  );
}

function ProtectedRoute({ children }) {
  const location = useLocation();
  const [auth, setAuth] = useState(location.state?.user ? 'yes' : 'checking');
  const [user, setUser] = useState(location.state?.user || null);

  useEffect(() => {
    if (location.state?.user) return;
    authMe()
      .then((u) => { setUser(u); setAuth('yes'); })
      .catch(() => setAuth('no'));
  }, []); // eslint-disable-line

  if (auth === 'checking') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#030305] text-cyan-400 font-mono text-xs tracking-[0.3em] uppercase opacity-70">
        Héj inicializálása...
      </div>
    );
  }
  if (auth === 'no') return <Navigate to="/login" replace />;
  return React.cloneElement(children, { user });
}

function AppRouter() {
  const location = useLocation();
  // CRITICAL: synchronous detection prevents race conditions
  if (location.hash?.includes('session_id=')) {
    return <AuthCallback />;
  }
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/shell" replace />} />
      <Route path="/login" element={<Login />} />
      <Route path="/shell" element={<ProtectedRoute><Shell /></ProtectedRoute>} />
      <Route path="/ledger" element={<ProtectedRoute><Ledger /></ProtectedRoute>} />
      <Route path="/sandbox" element={<ProtectedRoute><Sandbox /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/shell" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="scanlines">
        <AppRouter />
        <Toaster theme="dark" position="bottom-right" />
      </div>
    </BrowserRouter>
  );
}
