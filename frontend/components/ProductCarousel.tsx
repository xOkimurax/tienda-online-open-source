'use client';

import { useRef } from 'react';
import { ProductCard } from './ProductCard';
import { Icon } from './Icon';
import { Product } from '@/lib/types';

// Native horizontal scroll (with snap points) rather than a JS-driven
// carousel library — works with touch swipe out of the box on mobile, the
// arrow buttons on desktop just scroll the same container by ~2 cards.
export function ProductCarousel({ products, title }: { products: Product[]; title: string }) {
  const scrollerRef = useRef<HTMLDivElement>(null);

  function scrollByCards(dir: 1 | -1) {
    const el = scrollerRef.current;
    if (!el) return;
    const cardWidth = el.querySelector<HTMLElement>('[data-carousel-item]')?.offsetWidth ?? 200;
    el.scrollBy({ left: dir * (cardWidth + 14) * 2, behavior: 'smooth' });
  }

  if (products.length === 0) return null;

  return (
    <div style={{ marginTop: 'var(--space-8)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-3)' }}>
        <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: 22, margin: 0 }}>{title}</h2>
        <div className="desktop-only" style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="btn btn-secondary btn-icon" aria-label="Anteriores" onClick={() => scrollByCards(-1)}>
            <Icon path='<path d="M15 18l-6-6 6-6"/>' size={16} strokeWidth={2.5} />
          </button>
          <button type="button" className="btn btn-secondary btn-icon" aria-label="Siguientes" onClick={() => scrollByCards(1)}>
            <Icon path='<path d="M9 18l6-6-6-6"/>' size={16} strokeWidth={2.5} />
          </button>
        </div>
      </div>
      <div
        ref={scrollerRef}
        style={{
          display: 'flex',
          gap: 14,
          overflowX: 'auto',
          scrollSnapType: 'x mandatory',
          paddingBottom: 6,
        }}
      >
        {products.map((p) => (
          <div key={p.id} data-carousel-item style={{ flex: '0 0 200px', scrollSnapAlign: 'start' }}>
            <ProductCard product={p} />
          </div>
        ))}
      </div>
    </div>
  );
}
