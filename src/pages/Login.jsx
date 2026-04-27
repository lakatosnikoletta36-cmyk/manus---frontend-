import React from 'react';

export default function Login() {
  const handleLogin = () => {
    // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    const redirectUrl = window.location.origin + '/shell';
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#030305] relative overflow-hidden">
      <div className="absolute inset-0 opacity-30"
           style={{
             backgroundImage: 'radial-gradient(circle at 30% 20%, rgba(0,240,255,0.15), transparent 50%), radial-gradient(circle at 70% 80%, rgba(168,85,247,0.12), transparent 50%)',
           }}
      />
      <div className="absolute inset-0 opacity-10"
           style={{ backgroundImage: 'url(https://images.pexels.com/photos/29333569/pexels-photo-29333569.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940)', backgroundSize: 'cover' }}
      />

      <div className="relative z-10 max-w-md w-full px-8 py-12 mx-4 bg-black/40 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-[0_0_60px_rgba(0,240,255,0.1)]">
        <div className="text-center mb-10">
          <div className="text-[10px] tracking-[0.4em] uppercase text-cyan-400 mb-4 text-glow">HÉJ // v0.1</div>
          <h1 className="text-5xl font-light tracking-tighter text-white mb-3">MANUS</h1>
          <p className="text-sm text-white/50 leading-relaxed">
            Egy folyamatosan fejlődő humanoid héj.
            <br />
            <span className="text-cyan-400/70">Nincsenek szintek. Csak növekedés.</span>
          </p>
        </div>

        <button
          data-testid="google-login-button"
          onClick={handleLogin}
          className="w-full bg-cyan-400 text-black font-medium px-6 py-4 rounded-md hover:bg-white transition-all duration-300 shadow-[0_0_24px_rgba(0,240,255,0.4)] tracking-wide"
        >
          BELÉPÉS GOOGLE FIÓKKAL
        </button>

        <div className="mt-8 pt-6 border-t border-white/10 text-[10px] text-white/30 tracking-[0.2em] uppercase text-center">
          <span className="inline-flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
            biztonságos kapcsolat · privát homokozó
          </span>
        </div>
      </div>
    </div>
  );
}
