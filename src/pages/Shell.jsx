import React from 'react';
import Avatar from '../components/Avatar';
import Chat from '../components/Chat';

const Shell = () => {
  const user = { name: "Gazda", id: "admin" };
  return (
    <div style={{ backgroundColor: 'black', minHeight: '100vh', color: '#00ffff' }}>
      <div style={{ display: 'flex', flexDirection: 'column', padding: '10px' }}>
        <div style={{ height: '350px', width: '100%' }}>
          <Avatar user={user} />
        </div>
        <div style={{ padding: '10px' }}>
          <Chat user={user} />
        </div>
      </div>
    </div>
  );
};

export default Shell;
