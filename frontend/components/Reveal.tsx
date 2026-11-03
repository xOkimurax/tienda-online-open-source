'use client';

import { ReactNode, useEffect, useRef, useState } from 'react';

// Wraps a section in the CSS fade+rise defined in globals.css
// (.reveal-on-scroll / .is-visible) — a no-op under every theme except
// Apple Cinematic, where it drives the scroll-triggered reveal. Safe to
// sprinkle around any section regardless of which theme is active.
export function Reveal({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15, rootMargin: '0px 0px -60px 0px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className={`reveal-on-scroll${visible ? ' is-visible' : ''}`} style={{ transitionDelay: visible ? `${delay}ms` : '0ms' }}>
      {children}
    </div>
  );
}
