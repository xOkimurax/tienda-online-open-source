'use client';

import { useEffect } from 'react';

// The <title>/favicon in app/layout.tsx are static build-time fallbacks —
// the real store name and logo live in the database and are only known
// once the branding config loads client-side, so the browser tab has to
// be updated imperatively here instead of via Next.js metadata.
export function useBrandingMeta(nombre: string, logoUrl: string | null) {
  useEffect(() => {
    if (nombre) document.title = nombre;
  }, [nombre]);

  useEffect(() => {
    if (!logoUrl) return;
    let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.href = logoUrl;
  }, [logoUrl]);
}
