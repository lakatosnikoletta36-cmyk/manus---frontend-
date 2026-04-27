import React from 'react';

const Shell = () => {
  return (
    <div style={{ backgroundColor: 'black', color: '#00ffff', minHeight: '100vh', padding: '20px', textAlign: 'center' }}>
      <h1 style={{ fontSize: '24px', marginBottom: '20px' }}>MANUS RENDSZER</h1>
      <div style={{ border: '2px solid #00ffff', height: '300px', borderRadius: '50%', width: '300px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span>AVATAR ONLINE</span>
      </div>
      <div style={{ marginTop: '20px', padding: '10px', border: '1px solid #333', background: '#111' }}>
        <p>A szerver válasza: [KÉSZ]</p>
      </div>
    </div>
  );
};

export default Shell;
