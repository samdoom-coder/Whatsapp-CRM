import { useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api } from '@/lib/api';

export interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string | null;
}

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  companyName: string;
  timezone: string;
  currency: string;
  logoUrl?: string | null;
  role: 'OWNER' | 'ADMIN' | 'MANAGER' | 'AGENT';
}

interface AuthState {
  token: string | null;
  user: User | null;
  workspaces: Workspace[];
  currentWorkspaceId: string | null;
  setSession: (token: string, user: User, workspaces: Workspace[]) => void;
  setUser: (user: User) => void;
  setWorkspaces: (workspaces: Workspace[]) => void;
  setCurrentWorkspace: (id: string) => void;
  logout: () => void;
  socket: Socket | null;
  connectSocket: () => void;
  disconnectSocket: () => void;
}

export const useAuth = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      workspaces: [],
      currentWorkspaceId: null,
      socket: null,
      setSession: (token, user, workspaces) =>
        set({
          token,
          user,
          workspaces,
          currentWorkspaceId: workspaces[0]?.id ?? null,
        }),
      setUser: (user) => set({ user }),
      setWorkspaces: (workspaces) => set({ workspaces }),
      setCurrentWorkspace: (id) => set({ currentWorkspaceId: id }),
      logout: () => {
        get().disconnectSocket();
        set({ token: null, user: null, workspaces: [], currentWorkspaceId: null });
        api.clearToken();
      },
      connectSocket: () => {
        const { token, socket } = get();
        if (!token || socket) return;
        const s = io('/', {
          auth: { token },
          transports: ['websocket', 'polling'],
        });
        s.on('connect', () => console.info('[socket] connected'));
        s.on('disconnect', () => console.info('[socket] disconnected'));
        set({ socket: s });
      },
      disconnectSocket: () => {
        const { socket } = get();
        socket?.disconnect();
        set({ socket: null });
      },
    }),
    {
      name: 'wa-crm-auth',
      partialize: (state) => ({
        token: state.token,
        user: state.user,
        workspaces: state.workspaces,
        currentWorkspaceId: state.currentWorkspaceId,
      }),
    },
  ),
);

export const useRealtime = () => {
  const socket = useAuth((s) => s.socket);
  useEffect(() => {
    useAuth.getState().connectSocket();
    return () => useAuth.getState().disconnectSocket();
  }, []);
  return socket;
};