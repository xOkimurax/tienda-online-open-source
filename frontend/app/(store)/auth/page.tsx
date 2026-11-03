'use client';

import { FormEvent, Suspense, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Script from 'next/script';
import { useStoreAuth } from '@/lib/StoreAuthContext';
import { useToast } from '@/lib/ToastContext';
import { ApiError, storeJson } from '@/lib/storeApi';

type Mode = 'login' | 'register' | 'recover';

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: { client_id: string; callback: (resp: { credential: string }) => void }) => void;
          renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void;
        };
      };
    };
  }
}

function GoogleButton({ onCredential }: { onCredential: (idToken: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  const [scriptReady, setScriptReady] = useState(false);

  // The GSI script may already be loaded (e.g. switching Ingresar/Crear
  // cuenta remounts this component) — catch that case in addition to onLoad.
  useEffect(() => {
    if (window.google) setScriptReady(true);
  }, []);

  useEffect(() => {
    if (!clientId || !scriptReady || !window.google || !ref.current) return;
    window.google.accounts.id.initialize({
      client_id: clientId,
      callback: (resp) => onCredential(resp.credential),
    });
    // shape:'pill' matches the rounded buttons used everywhere else in the
    // UI (default is a squared-off rectangle); logo_alignment:'center' keeps
    // the G logo + text centered as one block instead of the logo pinned to
    // the left edge with the text off-center in the remaining space. Width
    // is measured from the container so it lines up with the other
    // btn-block buttons instead of the hardcoded 320px leaving a lopsided
    // gap on either side.
    const width = Math.min(400, ref.current.offsetWidth || 320);
    window.google.accounts.id.renderButton(ref.current, {
      theme: 'outline',
      size: 'large',
      shape: 'pill',
      logo_alignment: 'center',
      width,
    });
  }, [clientId, scriptReady, onCredential]);

  if (!clientId) {
    return (
      <button type="button" className="btn btn-secondary btn-block" disabled style={{ padding: 14 }}>
        Google (configurar GOOGLE_CLIENT_ID)
      </button>
    );
  }
  return (
    <>
      <Script src="https://accounts.google.com/gsi/client" strategy="lazyOnload" onLoad={() => setScriptReady(true)} />
      <div ref={ref} />
    </>
  );
}

function AuthInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get('redirect') ?? '/';
  const { login, register, loginWithGoogle } = useStoreAuth();
  const flash = useToast();
  const [mode, setMode] = useState<Mode>('login');
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmitLogin(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await login(email, password);
      flash('Sesión iniciada');
      router.push(redirect);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo iniciar sesión');
    } finally {
      setSubmitting(false);
    }
  }

  async function onSubmitRegister(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await register(nombre, email, password);
      flash('Cuenta creada');
      router.push(redirect);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo crear la cuenta');
    } finally {
      setSubmitting(false);
    }
  }

  async function onGoogleCredential(idToken: string) {
    try {
      await loginWithGoogle(idToken);
      flash('Sesión iniciada');
      router.push(redirect);
    } catch {
      setError('No se pudo iniciar sesión con Google');
    }
  }

  async function sendRecovery(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await storeJson('/api/store/auth/forgot-password', 'POST', { email });
    } catch {
      // Swallowed on purpose: the message below is intentionally the same
      // whether or not the email exists, so this screen never confirms or
      // denies that an account is registered.
    } finally {
      setSubmitting(false);
      flash('Si el email corresponde a una cuenta existente, te llegará un correo con el enlace de recuperación');
    }
  }

  return (
    <div style={{ maxWidth: 840, margin: 'var(--space-8) auto' }}>
      <div className="card elev-md auth-card" style={{ flexDirection: 'row', padding: 0, overflow: 'hidden', minHeight: 520 }}>
        <div
          className="washed"
          style={{
            flex: '1 1 40%',
            position: 'relative',
            background: 'linear-gradient(135deg, var(--color-accent-500), var(--color-accent-2-500))',
            padding: 'var(--space-6)',
            display: 'flex',
            alignItems: 'flex-end',
          }}
        >
          <div style={{ position: 'relative', zIndex: 1 }}>
            <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: 30, color: '#fff', margin: '0 0 12px' }}>Bienvenido</h2>
            <p style={{ fontSize: 14.5, color: 'rgba(255,255,255,.9)', lineHeight: 1.6, maxWidth: '32ch' }}>
              Creá tu cuenta para guardar favoritos, seguir tus pedidos y agilizar tus próximas compras.
            </p>
          </div>
        </div>

        <div style={{ flex: '1 1 60%', padding: 'var(--space-6) var(--space-8)', display: 'flex', flexDirection: 'column' }}>
          <div className="seg" role="radiogroup" style={{ marginBottom: 'var(--space-4)', width: '100%' }}>
            <label className="seg-opt">
              <input type="radio" name="authmode" checked={mode === 'login'} onChange={() => setMode('login')} />Ingresar
            </label>
            <label className="seg-opt">
              <input type="radio" name="authmode" checked={mode === 'register'} onChange={() => setMode('register')} />Crear cuenta
            </label>
            <label className="seg-opt">
              <input type="radio" name="authmode" checked={mode === 'recover'} onChange={() => setMode('recover')} />Recuperar
            </label>
          </div>

          {error && <p style={{ color: 'var(--color-accent-700)', fontSize: 13, margin: '0 0 var(--space-3)' }}>{error}</p>}

          {mode === 'login' && (
            <form onSubmit={onSubmitLogin}>
              <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 26, margin: '0 0 var(--space-4)' }}>Ingresá a tu cuenta</h1>
              <div className="field"><label>Email</label><input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="vos@email.com" style={{ padding: '14px 16px', fontSize: 14.5 }} /></div>
              <div className="field"><label>Contraseña</label><input className="input" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" style={{ padding: '14px 16px', fontSize: 14.5 }} /></div>
              <button type="submit" className="btn btn-primary btn-block" disabled={submitting} style={{ padding: 14 }}>Ingresar</button>
              <div style={{ textAlign: 'center', margin: 'var(--space-4) 0', fontSize: 12, opacity: 0.5 }}>o continuá con</div>
              <GoogleButton onCredential={onGoogleCredential} />
            </form>
          )}

          {mode === 'register' && (
            <form onSubmit={onSubmitRegister}>
              <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 26, margin: '0 0 var(--space-4)' }}>Creá tu cuenta</h1>
              <div className="field"><label>Nombre</label><input className="input" required value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Tu nombre" style={{ padding: '14px 16px', fontSize: 14.5 }} /></div>
              <div className="field"><label>Email</label><input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="vos@email.com" style={{ padding: '14px 16px', fontSize: 14.5 }} /></div>
              <div className="field"><label>Contraseña</label><input className="input" type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" style={{ padding: '14px 16px', fontSize: 14.5 }} /></div>
              <button type="submit" className="btn btn-primary btn-block" disabled={submitting} style={{ padding: 14 }}>Crear cuenta</button>
              <div style={{ textAlign: 'center', margin: 'var(--space-4) 0', fontSize: 12, opacity: 0.5 }}>o continuá con</div>
              <GoogleButton onCredential={onGoogleCredential} />
            </form>
          )}

          {mode === 'recover' && (
            <form onSubmit={sendRecovery}>
              <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 26, margin: '0 0 var(--space-4)' }}>Recuperar contraseña</h1>
              <p style={{ fontSize: 12.5, opacity: 0.65, lineHeight: 1.5, margin: '0 0 var(--space-3)' }}>
                Si el email corresponde a una cuenta existente, te llegará un correo con el enlace de recuperación.
              </p>
              <div className="field"><label>Email</label><input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="vos@email.com" style={{ padding: '14px 16px', fontSize: 14.5 }} /></div>
              <button type="submit" className="btn btn-primary btn-block" disabled={submitting} style={{ padding: 14 }}>Enviar enlace de recuperación</button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AuthPage() {
  return (
    <Suspense fallback={null}>
      <AuthInner />
    </Suspense>
  );
}
