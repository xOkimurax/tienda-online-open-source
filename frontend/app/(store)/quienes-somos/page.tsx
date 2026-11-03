'use client';

import { useEffect, useState } from 'react';
import { storeJson } from '@/lib/storeApi';
import { Icon } from '@/components/Icon';
import { AboutContent } from '@/lib/types';

export default function QuienesSomosPage() {
  const [about, setAbout] = useState<AboutContent | null>(null);

  useEffect(() => {
    storeJson<AboutContent>('/api/store/content/about', 'GET').then(setAbout);
  }, []);

  if (!about) return null;

  const portadaBg = about.fotoPortadaUrl
    ? `url(${about.fotoPortadaUrl}) center/cover`
    : 'linear-gradient(135deg, var(--color-accent-300), var(--color-accent-2-300))';

  return (
    <div>
      <div className="washed" style={{ position: 'relative', borderRadius: 'var(--radius-lg)', overflow: 'hidden', height: 280, marginBottom: 'var(--space-6)', background: portadaBg }}>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'flex-end', padding: 'var(--space-6)', background: 'linear-gradient(to top, rgba(0,0,0,.35), transparent)' }}>
          <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 36, margin: 0, color: '#fff' }}>Quiénes somos</h1>
        </div>
      </div>

      <div className="grid-main-side" style={{ gap: 'var(--space-8)' }}>
        <div>
          <div style={{ fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase', opacity: 0.55, marginBottom: 'var(--space-2)' }}>Nuestra historia</div>
          <p style={{ fontSize: 15.5, lineHeight: 1.6, opacity: 0.85, maxWidth: '65ch' }}>{about.historia}</p>
          {about.anioFundacion && (
            <p style={{ fontSize: 14, opacity: 0.6 }}>
              Abrimos nuestras puertas en {about.anioFundacion} y desde entonces seguimos creciendo junto a nuestros clientes.
            </p>
          )}
        </div>
        <div className="card elev-sm">
          <div className="card-title">Visitanos</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', marginTop: 8, fontSize: 14 }}>
            {about.direccion && (
              <div style={{ display: 'flex', gap: 10, minWidth: 0 }}>
                <Icon path='<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"></path><circle cx="12" cy="10" r="3"></circle>' size={18} stroke="var(--color-accent-700)" strokeWidth={2.5} />
                <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>{about.direccion}</span>
              </div>
            )}
            {about.telefono && (
              <div style={{ display: 'flex', gap: 10, minWidth: 0 }}>
                <Icon path='<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.362 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.338 1.85.573 2.81.7A2 2 0 0 1 22 16.92Z"></path>' size={18} stroke="var(--color-accent-700)" strokeWidth={2.5} />
                <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>{about.telefono}</span>
              </div>
            )}
            {about.emailContacto && (
              <div style={{ display: 'flex', gap: 10, minWidth: 0 }}>
                <Icon path='<rect x="2" y="4" width="20" height="16" rx="2"></rect><path d="m22 6-10 7L2 6"></path>' size={18} stroke="var(--color-accent-700)" strokeWidth={2.5} />
                <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>{about.emailContacto}</span>
              </div>
            )}
          </div>
          {about.fotoLocalUrl && (
            <div className="washed" style={{ marginTop: 'var(--space-4)', height: 140, borderRadius: 'var(--radius-md)', background: `url(${about.fotoLocalUrl}) center/cover` }} />
          )}
        </div>
      </div>

      {about.direccion && (
        <div style={{ marginTop: 'var(--space-8)' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 'var(--space-3)' }}>
            <div style={{ fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase', opacity: 0.55 }}>Cómo llegar</div>
            <a
              href={about.googleMapsUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(about.direccion)}`}
              target="_blank"
              rel="noreferrer"
              style={{ fontSize: 12.5, color: 'var(--color-accent-700)' }}
            >
              Abrir en Google Maps →
            </a>
          </div>
          <div style={{ borderRadius: 'var(--radius-lg)', overflow: 'hidden', height: 320 }}>
            <iframe
              title="Ubicación en el mapa"
              src={`https://www.google.com/maps?q=${encodeURIComponent(about.direccion)}&output=embed`}
              width="100%"
              height="100%"
              style={{ border: 0, display: 'block' }}
              loading="lazy"
            />
          </div>
        </div>
      )}
    </div>
  );
}
