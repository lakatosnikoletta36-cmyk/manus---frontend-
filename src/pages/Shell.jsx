import React from 'react';

const Shell = () => {
  return (
    <div style={{ backgroundColor: 'black', color: '#00ffff', minHeight: '100vh', padding: '20px', fontFamily: 'monospace' }}>
      <h1 style={{ textAlign: 'center' }}>MANUS INTERFÉSZ</h1>
      <div style={{ border: '1px solid #00ffff', padding: '20px', borderRadius: '10px', marginBottom: '20px', textAlign: 'center' }}>
        <p>A 3D Avatar betöltése...</p>
        {/* Ide jönne az Avatar, de most a stabilitás az első */}
      </div>
      <div style={{ border: '1px solid #00ffff', padding: '10px', height: '200px', overflowY: 'scroll', marginBottom: '10px' }}>
        <p>[RENDSZER]: Kapcsolódás a Gemini agyhoz...</p>
        <p>[INFO]: Ha ezt látod, a Vercel végre sikeresen lefordította a kódot!</p>
      </div>
      <input 
        type="text" 
        placeholder="Írj valamit..." 
        style={{ width: '100%', padding: '10px', background: '#111', border: '1px solid #00ffff', color: 'white' }}
      />
    </div>
  );
};

export default Shell;
