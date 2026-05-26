import { useState, useEffect } from 'react';
import type { User } from '../types';

export function useAuth() {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authForm, setAuthForm] = useState({ name: '', email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [requires2FA, setRequires2FA] = useState(false);
  const [totpToken, setTotpToken] = useState('');
  const [setup2FA, setSetup2FA] = useState<{ qrCodeUrl?: string; userId?: string } | null>(null);
  const [isFirstRun, setIsFirstRun] = useState(false);

  useEffect(() => {
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      const response = await originalFetch(...args);
      if (response.status === 401) {
        console.warn('Sessão expirada (401). Deslogando usuário...');
        localStorage.removeItem('olympus_token');
        localStorage.removeItem('olympus_user');
        setToken(null);
        setUser(null);
      }
      return response;
    };
    return () => { window.fetch = originalFetch; };
  }, []);

  useEffect(() => {
    if (token) return;
    fetch('/api/v1/auth/setup-status')
      .then(r => r.json())
      .then(d => {
        if (d.hasUsers === false) {
          setIsFirstRun(true);
          setAuthMode('register');
          setAuthForm(prev => ({ ...prev, name: 'Administrador' }));
        }
      })
      .catch(console.error);
  }, [token]);

  const login = async (form: typeof authForm, totp?: string) => {
    const res = await fetch('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, token: totp }),
    });
    if (!res.ok) {
      const txt = await res.text();
      try { throw new Error(JSON.parse(txt).error || 'Erro na autenticação'); }
      catch { throw new Error('Falha no Servidor (500/502). O Backend pode estar offline.\n\nDetalhes: ' + txt.slice(0, 100)); }
    }
    const data = await res.json();
    if (data.requires2FA) { setRequires2FA(true); return; }
    localStorage.setItem('olympus_token', data.token);
    localStorage.setItem('olympus_user', JSON.stringify(data.user));
    setToken(data.token);
    setUser(data.user);
  };

  const register = async (form: typeof authForm): Promise<User> => {
    const res = await fetch('/api/v1/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    if (!res.ok) {
      const txt = await res.text();
      try { throw new Error(JSON.parse(txt).error || 'Erro no cadastro'); }
      catch { throw new Error('Falha no Servidor (500/502). O Backend pode estar offline.\n\nDetalhes: ' + txt.slice(0, 100)); }
    }
    const data = await res.json();
    setIsFirstRun(false);
    return data.user;
  };

  const enable2FA = async (userId: string, totp: string) => {
    const res = await fetch('/api/v1/auth/2fa/enable', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, token: totp }),
    });
    if (!res.ok) {
      const txt = await res.text();
      try { throw new Error(JSON.parse(txt).error); }
      catch { throw new Error('Erro 2FA: ' + txt.slice(0, 100)); }
    }
  };

  const generate2FA = async (userId: string) => {
    const res = await fetch('/api/v1/auth/2fa/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });
    if (!res.ok) throw new Error('Erro ao gerar QR Code');
    return res.json() as Promise<{ qrCodeUrl: string }>;
  };

  const logout = () => {
    localStorage.removeItem('olympus_token');
    localStorage.removeItem('olympus_user');
    setToken(null);
    setUser(null);
  };

  return {
    token, user,
    authMode, setAuthMode,
    authForm, setAuthForm,
    showPassword, setShowPassword,
    requires2FA, setRequires2FA,
    totpToken, setTotpToken,
    setup2FA, setSetup2FA,
    isFirstRun,
    login, register, enable2FA, generate2FA, logout,
  };
}
