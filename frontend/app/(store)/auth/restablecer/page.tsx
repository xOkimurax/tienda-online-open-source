'use client';

import { FormEvent, Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { storeJson, ApiError } from '@/lib/storeApi';
import { useToast } from '@/lib/ToastContext';

function RestablecerForm() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get('token') ?? '';
  const flash = useToast();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError('Las contraseñas no coinciden');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await storeJson('/api/store/auth/reset-password', 'POST', { token, password });
      setDone(true);
      flash('Contraseña actualizada');
      setTimeout(() => router.push('/auth'), 1500);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo restablecer la contraseña');
    } finally {
      setSubmitting(false);
    }
  }

  if (!token) {
    return (
      <div style={{ maxWidth: 480, margin: 'var(--space-8) auto' }}>
        <div className="card elev-md" style={{ padding: 'var(--space-6)' }}>
          <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 24, margin: '0 0 8px' }}>Enlace inválido</h1>
          <p style={{ fontSize: 14, opacity: 0.7, margin: '0 0 var(--space-4)' }}>
            Este enlace de recuperación no es válido. Pedí uno nuevo desde la página de ingreso.
          </p>
          <Link href="/auth" className="btn btn-primary btn-block">Volver a Ingresar</Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 480, margin: 'var(--space-8) auto' }}>
      <form onSubmit={onSubmit} className="card elev-md" style={{ padding: 'var(--space-6)' }}>
        <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 24, margin: '0 0 4px' }}>Elegí tu nueva contraseña</h1>
        <p style={{ margin: '0 0 var(--space-4)', opacity: 0.6, fontSize: 14 }}>Este enlace vence a la hora de haberse generado</p>

        {done ? (
          <p style={{ fontSize: 14 }}>Listo, redirigiendo al ingreso…</p>
        ) : (
          <>
            <div className="field">
              <label>Nueva contraseña</label>
              <input className="input" type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} style={{ padding: '14px 16px', fontSize: 14.5 }} />
            </div>
            <div className="field" style={{ marginTop: 'var(--space-3)' }}>
              <label>Confirmar contraseña</label>
              <input className="input" type="password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} style={{ padding: '14px 16px', fontSize: 14.5 }} />
            </div>
            {error && <p style={{ color: 'var(--color-accent-700)', fontSize: 13, margin: 'var(--space-2) 0 0' }}>{error}</p>}
            <button type="submit" className="btn btn-primary btn-block" disabled={submitting} style={{ marginTop: 'var(--space-4)', padding: 14 }}>
              {submitting ? 'Guardando…' : 'Restablecer contraseña'}
            </button>
          </>
        )}
      </form>
    </div>
  );
}

export default function RestablecerPage() {
  return (
    <Suspense fallback={null}>
      <RestablecerForm />
    </Suspense>
  );
}
