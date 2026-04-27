import React from 'react';
import Avatar from '../components/Avatar';
import Chat from '../components/Chat';
import Log from '../components/Log';

const Shell = () => {
  // Fixált felhasználó a bypasshoz
  const user = { name: "Gazda", id: "admin" };

  return (
    <div className="min-h-screen bg-black text-cyan-500 overflow-y-auto">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 p-4">
        <div className="h-[300px] lg:h-[calc(100vh-2rem)] sticky top-0">
          <Avatar user={user} />
        </div>
        <div className="flex flex-col gap-4">
          <Chat user={user} />
          <Log />
        </div>
      </div>
    </div>
  );
};

export default Shell;
