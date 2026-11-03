'use client';

import { FormEvent, Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { adminJson, ApiError } from '@/lib/adminApi';

function AcceptInviteForm() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get('token') ?? '';
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
      await adminJson('/api/admin/auth/accept-invite', 'POST', { token, password });
      setDone(true);
      setTimeout(() => router.push('/admin/login'), 1500);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo configurar la cuenta');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--color-bg)',
      }}
    >
      <form onSubmit={onSubmit} className="card elev-md" style={{ width: 360, padding: 'var(--space-6)' }}>
        <h1 style={{ fontSize: 24, margin: '0 0 4px' }}>Configurá tu acceso</h1>
        <p style={{ margin: '0 0 var(--space-4)', opacity: 0.6, fontSize: 14 }}>Elegí una contraseña para tu cuenta</p>

        {done ? (
          <p style={{ fontSize: 14 }}>Listo, redirigiendo al login…</p>
        ) : (
          <>
            <div className="field">
              <label>Nueva contraseña</label>
              <input
                className="input"
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div className="field" style={{ marginTop: 'var(--space-3)' }}>
              <label>Confirmar contraseña</label>
              <input
                className="input"
                type="password"
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </div>
            {error && (
              <p style={{ color: 'var(--color-accent-700)', fontSize: 13, margin: 'var(--space-2) 0 0' }}>{error}</p>
            )}
            <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
              {submitting ? 'Guardando…' : 'Guardar y continuar'}
            </button>
          </>
        )}
      </form>
    </div>
  );
}

export default function AcceptInvitePage() {
  return (
    <Suspense fallback={null}>
      <AcceptInviteForm />
    </Suspense>
  );
}
