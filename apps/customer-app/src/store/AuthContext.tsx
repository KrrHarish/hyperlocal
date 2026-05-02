import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { registerPushToken } from '../utils/registerPushToken';

interface AuthState {
  token: string | null;
  userId: string | null;
  phone: string | null;
  isLoading: boolean;
}

interface AuthContextType extends AuthState {
  login: (token: string, userId: string, phone: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    token: null, userId: null, phone: null, isLoading: true,
  });

  useEffect(() => {
    (async () => {
      const token  = await AsyncStorage.getItem('zuqu_token');
      const userId = await AsyncStorage.getItem('zuqu_user_id');
      const phone  = await AsyncStorage.getItem('zuqu_phone');
      setState({ token, userId, phone, isLoading: false });
    })();
  }, []);

  const login = async (token: string, userId: string, phone: string) => {
    await AsyncStorage.multiSet([
      ['zuqu_token',   token],
      ['zuqu_user_id', userId],
      ['zuqu_phone',   phone],
    ]);
    setState({ token, userId, phone, isLoading: false });
    // Register Expo push token so we can receive order notifications
    registerPushToken().catch(() => {})
  };

  const logout = async () => {
    await AsyncStorage.multiRemove(['zuqu_token', 'zuqu_user_id', 'zuqu_phone']);
    setState({ token: null, userId: null, phone: null, isLoading: false });
  };

  return (
    <AuthContext.Provider value={{ ...state, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
};
