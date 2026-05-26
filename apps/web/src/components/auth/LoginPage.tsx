import React from 'react';
import { AgentMark } from '../ui/AgentMark';
import type { useAuth } from '../../hooks/useAuth';

type AuthHook = ReturnType<typeof useAuth>;

interface LoginPageProps {
  auth: AuthHook;
}

const ENGINE_CARDS = [
  { agent: 'HERMES' as const, label: 'ATHENA', sub: 'Motor de Produção', detail: '7 metodologias · MSEF ativo' },
  { agent: 'KRATOS' as const, label: 'KRATOS', sub: 'Monitoramento Contínuo', detail: 'Varredura periódica · Alertas' },
];

export function LoginPage({ auth }: LoginPageProps) {
  const { authMode, setAuthMode, authForm, setAuthForm, showPassword, setShowPassword,
    requires2FA, setRequires2FA, totpToken, setTotpToken, setup2FA, setSetup2FA,
    isFirstRun, login, register, enable2FA, generate2FA } = auth;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (setup2FA) {
        await enable2FA(setup2FA.userId!, totpToken);
        alert('2FA configurado com sucesso! Faça login.');
        setSetup2FA(null);
        setAuthMode('login');
        setTotpToken('');
        setAuthForm({ ...authForm, password: '' });
        return;
      }

      if (authMode === 'login') {
        await login(authForm, requires2FA ? totpToken : undefined);
      } else {
        const newUser = await register(authForm);
        if (window.confirm('Cadastro realizado! Deseja configurar a Autenticação em Duas Etapas (2FA) agora para maior segurança?')) {
          const data2fa = await generate2FA(newUser.id);
          setSetup2FA({ qrCodeUrl: data2fa.qrCodeUrl, userId: newUser.id });
        } else {
          alert('Faça login para continuar.');
          setAuthMode('login');
          setAuthForm({ ...authForm, password: '' });
        }
      }
    } catch (err: any) { alert(err.message); }
  };

  return (
    <div style={{ background: '#0D1612', minHeight: '100vh', display: 'flex', flexDirection: 'column', fontFamily: "'DM Sans', system-ui, sans-serif" }}>

      <div style={{ textAlign: 'center', padding: '9px 16px', fontFamily: "'DM Mono', 'Cascadia Code', monospace", fontSize: 9.5, letterSpacing: '2px', fontWeight: 700, color: '#E65100', background: 'rgba(230,81,0,.08)', borderBottom: '1px solid rgba(230,81,0,.18)', textTransform: 'uppercase' }}>
        ⬢ CONFIDENCIAL — SISTEMA DE ACESSO RESTRITO
      </div>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px 40px', gap: 64, flexWrap: 'wrap' }}>

        {/* Branding */}
        <div style={{ maxWidth: 460, flex: 1, minWidth: 280 }}>
          <div style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 64, fontWeight: 700, color: '#fff', letterSpacing: '-1px', lineHeight: 1 }}>OLYMPUS</div>
          <div style={{ fontFamily: "'DM Mono', 'Cascadia Code', monospace", fontSize: 11, color: '#C9A84C', letterSpacing: '2.5px', marginTop: 10, textTransform: 'uppercase' }}>StratSight BR · Strategic Foresight</div>
          <div style={{ fontSize: 13, color: '#6B8C7A', lineHeight: 1.6, marginTop: 12, maxWidth: 380 }}>Plataforma de inteligência prospectiva para análise e monitoramento estratégico de cenários futuros.</div>
          <div style={{ display: 'flex', gap: 12, marginTop: 36 }}>
            {ENGINE_CARDS.map(card => (
              <div key={card.label} style={{ flex: 1, background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 12, padding: '18px 16px' }}>
                <AgentMark name={card.agent} scale="compact" size={28} />
                <div style={{ fontWeight: 700, color: '#fff', marginTop: 10, fontSize: 12, letterSpacing: '1.2px', fontFamily: "'DM Sans', sans-serif" }}>{card.label}</div>
                <div style={{ fontSize: 11, color: '#6B8C7A', marginTop: 4 }}>{card.sub}</div>
                <div style={{ fontSize: 10, color: '#5A9E6F', marginTop: 3 }}>{card.detail}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Auth form */}
        <div style={{ width: 360, flexShrink: 0, minWidth: 300 }}>
          <div style={{ background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 16, padding: '32px', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(90deg, #C9A84C 0%, #5A9E6F 100%)' }} />

            <div style={{ marginBottom: 24 }}>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9.5, letterSpacing: '2px', color: '#6B8C7A', textTransform: 'uppercase', marginBottom: 6 }}>
                {authMode === 'login' ? 'Autenticação · Acesso Restrito' : 'Cadastro de Usuário'}
              </div>
              <div style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 22, fontWeight: 700, color: '#fff' }}>
                {authMode === 'login' ? 'Entrar no sistema' : 'Novo usuário'}
              </div>
            </div>

            {isFirstRun && authMode === 'register' && (
              <div style={{ marginBottom: 16, background: 'rgba(167,139,250,.1)', border: '1px solid rgba(167,139,250,.3)', color: '#c4b5fd', fontSize: 12, padding: '12px', borderRadius: 8, textAlign: 'center' }}>
                <strong>Sistema não configurado.</strong><br />
                O primeiro usuário receberá automaticamente o perfil de <strong>Administrador</strong>.
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {setup2FA ? (
                <div className="flex flex-col items-center text-center">
                  <p className="text-sm mb-4" style={{ color: '#A3C9AE' }}>Escaneie o QR Code abaixo com seu app autenticador e insira o código gerado.</p>
                  <img src={setup2FA.qrCodeUrl} alt="QR Code 2FA" className="w-48 h-48 mb-4 border p-2 rounded-xl" style={{ background: '#fff' }} />
                  <input type="text" placeholder="Código de 6 dígitos" required value={totpToken} onChange={e => setTotpToken(e.target.value)} className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 outline-none focus:border-stratsight-medium transition-colors text-center tracking-widest text-lg font-mono" maxLength={6} />
                  <button type="submit" className="w-full bg-stratsight-dark text-white font-bold py-3.5 rounded-xl hover:bg-stratsight-medium transition-colors shadow-lg shadow-green-900/20 mt-4">Confirmar 2FA</button>
                  <button type="button" onClick={() => { setSetup2FA(null); setAuthMode('login'); setAuthForm({ ...authForm, password: '' }); }} style={{ marginTop: 12, background: 'none', border: 'none', color: '#6B8C7A', fontSize: 12, cursor: 'pointer' }}>Pular por enquanto</button>
                </div>
              ) : requires2FA ? (
                <div className="flex flex-col items-center text-center">
                  <p className="text-sm mb-4" style={{ color: '#A3C9AE' }}>Esta conta está protegida por 2FA. Insira o código do seu aplicativo.</p>
                  <input type="text" placeholder="Código de 6 dígitos" required value={totpToken} onChange={e => setTotpToken(e.target.value)} className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 outline-none focus:border-stratsight-medium transition-colors text-center tracking-widest text-lg font-mono" maxLength={6} />
                  <button type="submit" className="w-full bg-stratsight-dark text-white font-bold py-3.5 rounded-xl hover:bg-stratsight-medium transition-colors shadow-lg shadow-green-900/20 mt-4">Verificar e Entrar</button>
                  <button type="button" onClick={() => { setRequires2FA(false); setTotpToken(''); }} style={{ marginTop: 12, background: 'none', border: 'none', color: '#6B8C7A', fontSize: 12, cursor: 'pointer' }}>Voltar</button>
                </div>
              ) : (
                <>
                  {authMode === 'register' && <input type="text" placeholder="Nome Completo" required value={authForm.name} onChange={e => setAuthForm({ ...authForm, name: e.target.value })} className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 outline-none focus:border-stratsight-medium transition-colors" />}
                  <input type="email" placeholder="E-mail corporativo" required value={authForm.email} onChange={e => setAuthForm({ ...authForm, email: e.target.value })} className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 outline-none focus:border-stratsight-medium transition-colors" />
                  <div className="relative">
                    <input type={showPassword ? 'text' : 'password'} placeholder="Senha" required value={authForm.password} onChange={e => setAuthForm({ ...authForm, password: e.target.value })} className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 outline-none focus:border-stratsight-medium transition-colors pr-10" />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-3.5 text-gray-400 hover:text-stratsight-medium focus:outline-none">
                      {showPassword ? '🙈' : '👁️'}
                    </button>
                  </div>
                  <button type="submit" className="w-full bg-stratsight-dark text-white font-bold py-3.5 rounded-xl hover:bg-stratsight-medium transition-colors shadow-lg shadow-green-900/20">
                    {authMode === 'login' ? 'Autenticar →' : 'Cadastrar'}
                  </button>
                </>
              )}
            </form>

            {!setup2FA && !requires2FA && !isFirstRun && (
              <div style={{ marginTop: 20, textAlign: 'center' }}>
                <button onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')} style={{ background: 'none', border: 'none', color: '#6B8C7A', fontSize: 12, cursor: 'pointer' }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#A3C9AE')}
                  onMouseLeave={e => (e.currentTarget.style.color = '#6B8C7A')}>
                  {authMode === 'login' ? 'Não tem conta? Cadastre-se' : 'Já tem conta? Faça login'}
                </button>
              </div>
            )}
            {authMode === 'login' && !setup2FA && !requires2FA && (
              <div style={{ marginTop: 16, textAlign: 'center', fontFamily: "'DM Mono', monospace", fontSize: 9.5, color: '#3D6B50', letterSpacing: '0.5px' }}>
                Protegido por autenticação JWT · 2FA disponível
              </div>
            )}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 24px', borderTop: '1px solid rgba(255,255,255,.06)', fontFamily: "'DM Mono', 'Cascadia Code', monospace", fontSize: 10, color: '#3D6B50', letterSpacing: '0.5px' }}>
        <span>v1.0</span>
        <span>© {new Date().getFullYear()} OLYMPUS StratSight BR — Uso Restrito</span>
      </div>
    </div>
  );
}
