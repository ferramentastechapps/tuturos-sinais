import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  validateLogin,
  saveSession,
  recordFailedAttempt,
  checkRateLimit,
  resetRateLimit,
  isSessionValid,
} from '@/lib/adminAuth';
import { Lock, Mail, AlertTriangle, ShieldCheck, Clock } from 'lucide-react';

function formatBlockTime(ms: number): string {
  const sec = Math.ceil(ms / 1000);
  if (sec >= 60) return `${Math.ceil(sec / 60)} min`;
  return `${sec}s`;
}

export default function Login() {
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [blockedMs, setBlockedMs] = useState<number | null>(null);

  // Redirect to dashboard if already authenticated
  useEffect(() => {
    if (isSessionValid()) {
      navigate('/', { replace: true });
    }
  }, [navigate]);

  // Countdown timer when blocked
  useEffect(() => {
    if (blockedMs === null) return;
    if (blockedMs <= 0) {
      setBlockedMs(null);
      return;
    }
    const timer = setTimeout(() => setBlockedMs(prev => (prev !== null ? prev - 1000 : null)), 1000);
    return () => clearTimeout(timer);
  }, [blockedMs]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Check rate limit before doing anything
    const remaining = checkRateLimit();
    if (remaining !== null) {
      setBlockedMs(remaining);
      return;
    }

    setLoading(true);

    // Artificial 600ms delay so the loading state is visible and prevents timing attacks
    await new Promise(res => setTimeout(res, 600));

    if (validateLogin(email, password)) {
      resetRateLimit();
      saveSession();
      navigate('/', { replace: true });
    } else {
      const { blocked, remainingMs } = recordFailedAttempt();
      if (blocked && remainingMs !== null) {
        setBlockedMs(remainingMs);
        setError('');
      } else {
        setError('Email ou senha inválidos. Verifique as credenciais.');
      }
    }

    setLoading(false);
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0a0a0f 0%, #0d1117 50%, #0a0f1a 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: "'Inter', system-ui, sans-serif",
      padding: '1rem',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Ambient glow effects */}
      <div style={{
        position: 'absolute',
        top: '20%',
        left: '50%',
        transform: 'translateX(-50%)',
        width: '600px',
        height: '600px',
        background: 'radial-gradient(ellipse, rgba(99, 102, 241, 0.06) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute',
        bottom: '10%',
        right: '20%',
        width: '300px',
        height: '300px',
        background: 'radial-gradient(ellipse, rgba(16, 185, 129, 0.04) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      {/* Login Card */}
      <div style={{
        width: '100%',
        maxWidth: '420px',
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: '20px',
        padding: '2.5rem 2rem',
        backdropFilter: 'blur(20px)',
        boxShadow: '0 25px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05) inset',
        position: 'relative',
      }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '16px',
            background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1.25rem',
            boxShadow: '0 0 30px rgba(99,102,241,0.3)',
          }}>
            <ShieldCheck size={32} color="white" />
          </div>
          <h1 style={{
            fontSize: '1.5rem',
            fontWeight: 700,
            color: '#f8fafc',
            margin: '0 0 0.375rem',
            letterSpacing: '-0.02em',
          }}>TUTUROS SINAIS</h1>
          <p style={{
            fontSize: '0.8rem',
            color: 'rgba(148,163,184,0.8)',
            margin: 0,
            textTransform: 'uppercase',
            letterSpacing: '0.15em',
            fontWeight: 500,
          }}>Sistema Administrativo</p>
        </div>

        {/* Blocked State */}
        {blockedMs !== null && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '10px',
            padding: '0.875rem 1rem',
            marginBottom: '1.25rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.625rem',
          }}>
            <Clock size={16} color="#ef4444" style={{ flexShrink: 0 }} />
            <div>
              <p style={{ margin: 0, fontSize: '0.8rem', color: '#ef4444', fontWeight: 600 }}>
                Acesso temporariamente bloqueado
              </p>
              <p style={{ margin: 0, fontSize: '0.75rem', color: 'rgba(239,68,68,0.7)', marginTop: '2px' }}>
                Aguarde {formatBlockTime(blockedMs)} para tentar novamente
              </p>
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && !blockedMs && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.08)',
            border: '1px solid rgba(239, 68, 68, 0.25)',
            borderRadius: '10px',
            padding: '0.75rem 1rem',
            marginBottom: '1.25rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}>
            <AlertTriangle size={15} color="#ef4444" style={{ flexShrink: 0 }} />
            <p style={{ margin: 0, fontSize: '0.8rem', color: '#fc8181' }}>{error}</p>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} autoComplete="off">
          {/* Email */}
          <div style={{ marginBottom: '1rem' }}>
            <label style={{
              display: 'block',
              fontSize: '0.75rem',
              fontWeight: 600,
              color: 'rgba(148,163,184,0.9)',
              marginBottom: '0.5rem',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
            }}>Email</label>
            <div style={{ position: 'relative' }}>
              <Mail size={15} color="rgba(148,163,184,0.5)" style={{
                position: 'absolute',
                left: '1rem',
                top: '50%',
                transform: 'translateY(-50%)',
                pointerEvents: 'none',
              }} />
              <input
                id="admin-email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                required
                disabled={loading || blockedMs !== null}
                placeholder="Digite o email"
                style={{
                  width: '100%',
                  padding: '0.75rem 1rem 0.75rem 2.75rem',
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '10px',
                  color: '#f1f5f9',
                  fontSize: '0.9rem',
                  outline: 'none',
                  boxSizing: 'border-box',
                  transition: 'border-color 0.2s, background 0.2s',
                  opacity: blockedMs !== null ? 0.5 : 1,
                }}
                onFocus={e => { e.target.style.borderColor = 'rgba(99,102,241,0.6)'; e.target.style.background = 'rgba(99,102,241,0.05)'; }}
                onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.1)'; e.target.style.background = 'rgba(255,255,255,0.04)'; }}
              />
            </div>
          </div>

          {/* Password */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{
              display: 'block',
              fontSize: '0.75rem',
              fontWeight: 600,
              color: 'rgba(148,163,184,0.9)',
              marginBottom: '0.5rem',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
            }}>Senha</label>
            <div style={{ position: 'relative' }}>
              <Lock size={15} color="rgba(148,163,184,0.5)" style={{
                position: 'absolute',
                left: '1rem',
                top: '50%',
                transform: 'translateY(-50%)',
                pointerEvents: 'none',
              }} />
              <input
                id="admin-password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete="new-password"
                required
                disabled={loading || blockedMs !== null}
                placeholder="Digite a senha"
                style={{
                  width: '100%',
                  padding: '0.75rem 1rem 0.75rem 2.75rem',
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '10px',
                  color: '#f1f5f9',
                  fontSize: '0.9rem',
                  outline: 'none',
                  boxSizing: 'border-box',
                  transition: 'border-color 0.2s, background 0.2s',
                  opacity: blockedMs !== null ? 0.5 : 1,
                }}
                onFocus={e => { e.target.style.borderColor = 'rgba(99,102,241,0.6)'; e.target.style.background = 'rgba(99,102,241,0.05)'; }}
                onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.1)'; e.target.style.background = 'rgba(255,255,255,0.04)'; }}
              />
            </div>
          </div>

          {/* Submit Button */}
          <button
            id="login-submit"
            type="submit"
            disabled={loading || blockedMs !== null}
            style={{
              width: '100%',
              padding: '0.875rem',
              background: loading || blockedMs !== null
                ? 'rgba(99,102,241,0.4)'
                : 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
              border: 'none',
              borderRadius: '10px',
              color: 'white',
              fontSize: '0.875rem',
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              cursor: loading || blockedMs !== null ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              transition: 'transform 0.15s, box-shadow 0.15s',
              boxShadow: loading || blockedMs !== null ? 'none' : '0 4px 20px rgba(99,102,241,0.35)',
            }}
            onMouseEnter={e => {
              if (!loading && !blockedMs) {
                (e.target as HTMLButtonElement).style.transform = 'translateY(-1px)';
                (e.target as HTMLButtonElement).style.boxShadow = '0 6px 24px rgba(99,102,241,0.45)';
              }
            }}
            onMouseLeave={e => {
              (e.target as HTMLButtonElement).style.transform = 'translateY(0)';
              (e.target as HTMLButtonElement).style.boxShadow = '0 4px 20px rgba(99,102,241,0.35)';
            }}
          >
            {loading ? (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ animation: 'spin 0.8s linear infinite' }}>
                  <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                </svg>
                Verificando...
              </>
            ) : 'Entrar no Sistema'}
          </button>
        </form>

        {/* Restricted Access Badge */}
        <div style={{
          marginTop: '1.75rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.5rem',
        }}>
          <AlertTriangle size={13} color="rgba(251,191,36,0.7)" />
          <span style={{
            fontSize: '0.72rem',
            color: 'rgba(148,163,184,0.5)',
            letterSpacing: '0.05em',
          }}>Acesso Restrito — Sistema exclusivo administrativo</span>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        input::placeholder { color: rgba(148,163,184,0.3); }
      `}</style>
    </div>
  );
}
