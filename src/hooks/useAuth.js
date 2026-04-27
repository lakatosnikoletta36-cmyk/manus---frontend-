import { useState } from 'react';
export const useAuth = () => {
  return {
    user: { id: 'admin', name: 'Gazda' },
    loading: false,
    authenticated: true
  };
};
