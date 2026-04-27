import React, { useState } from 'react';
import Avatar from '../components/Avatar';

const Shell = () => {
  const [msg, setMsg] = useState("");
  const user = { name: "Gazda", id: "admin" };

  return (
    <div style={{ backgroundColor: 'black', minHeight: '100vh', color: '#00ffff', display: 'flex', flexDirection: 'column' }}>
      {/* 3D AVATAR RÉSZ */}
      <div style={{ height: '350px', width: '100%', borderBottom: '1px solid #111' }}>
        <Avatar user={user} />
      </div>

      {/* SAJÁT CHAT ABLAK (Hogy ne legyen import hiba) */}
      <div style={{ flex: 1, padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
        <div style={{ border: '1px solid #00ffff', padding: '15px', borderRadius: '10px', background: 'rgba(0,255,255,0.05)', marginBottom: '10px' }}>
          <p style={{ margin: 0, fontSize: '14px', color: '#888' }}>MANUS:</p>
          <p style={{ margin: '5px 0 0 0' }}>Rendszer aktív. Készen állok az üzenetek fogadására.</p>
        </div>
        
        <input 
          type="text" 
          value={msg}
          onChange={(e) => setMsg(e.target.value)}
          placeholder="Írj ide..." 
          style={{ width: '100%', padding: '12px', background: '#111', border: '1px solid #00ffff', color: 'white', borderRadius: '5px' }}
        />
      </div>
    </div>
  );
};

export default Shell;
