import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface Rider {
  id: string;
  name: string;
  phone: string;
  vehicle_type: string;
  is_online: boolean;
  trust_score: number;
  wallet_balance: number;
}

interface AuthState {
  token: string | null;
  rider: Rider | null;
  isLoading: boolean;
}

interface AuthContextType extends AuthState {
  login:  (token: string, rider: Rider) => Promise<void>;
  logout: () => Promise<void>;
  updateRider: (patch: Partial<Rider>) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ token: null, rider: null, isLoading: true });

  useEffect(() => {
    (async () => {
      const token     = await AsyncStorage.getItem('zuqu_rider_token');
      const riderJson = await AsyncStorage.getItem('zuqu_rider_data');
      const rider     = riderJson ? JSON.parse(riderJson) : null;
      setState({ token, rider, isLoading: false });
    })();
  }, []);

  const login = async (token: string, rider: Rider) => {
    await AsyncStorage.multiSet([
      ['zuqu_rider_token', token],
      ['zuqu_rider_data',  JSON.stringify(rider)],
    ]);
    setState({ token, rider, isLoading: false });
  };

  const logout = async () => {
    await AsyncStorage.multiRemove(['zuqu_rider_token', 'zuqu_rider_data']);
    setState({ token: null, rider: null, isLoading: false });
  };

  const updateRider = (patch: Partial<Rider>) => {
    setState(s => {
      const updated = s.rider ? { ...s.rider, ...patch } : null;
      if (updated) AsyncStorage.setItem('zuqu_rider_data', JSON.stringify(updated));
      return { ...s, rider: updated };
    });
  };

  return (
    <AuthContext.Provider value={{ ...state, login, logout, updateRider }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
};
