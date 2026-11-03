'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { storeJson } from '@/lib/storeApi';
import { ProductCard } from '@/components/ProductCard';
import { Reveal } from '@/components/Reveal';
import { Icon } from '@/components/Icon';
import { PRODUCT_ICONS } from '@/lib/icons';
import { BrandingConfig, Paginated, Product } from '@/lib/types';

type FeaturedCategory = { id: string; nombre: string; images: string[] };

const TILE_BG = ['var(--color-accent-200)', 'var(--color-accent-2-200)', 'var(--color-neutral-200)'];
const TILE_ICON_STROKE = ['var(--color-accent-700)', 'var(--color-accent-2-700)', 'var(--color-neutral-700)'];

// Rotates through a category's product photos as the tile's background,
// replacing the old static icon — but only once there's more than one photo
// to rotate through (a single photo just sits still).
function CategoryTileCarousel({ images }: { images: string[] }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (images.length < 2) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % images.length), 3500);
    return () => clearInterval(id);
  }, [images.length]);

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      {images.map((url, i) => (
        <div
          key={url}
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: `url(${url})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            opacity: i === index ? 1 : 0,
            transition: 'opacity 1s ease',
          }}
        />
      ))}
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,.5), rgba(0,0,0,0) 60%)' }} />
    </div>
  );
}

function CategoryTile({ category, index, big }: { category: FeaturedCategory; index: number; big: boolean }) {
  const router = useRouter();
  const hasImages = category.images.length > 0;
  return (
    <div
      className="washed"
      style={{
        flex: big ? undefined : 1,
        minHeight: big ? undefined : 130,
        borderRadius: 'var(--radius-lg)',
        background: TILE_BG[index % TILE_BG.length],
        position: 'relative',
        cursor: 'pointer',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'flex-end',
        padding: 'var(--space-6)',
      }}
      onClick={() => router.push(`/catalogo?categoria=${category.id}`)}
    >
      {hasImages ? (
        <CategoryTileCarousel images={category.images} />
      ) : (
        <div style={{ position: 'absolute', top: big ? 28 : 18, right: big ? 28 : 18, opacity: 0.5 }}>
          <Icon path={PRODUCT_ICONS.camisa} size={big ? 90 : 56} stroke={TILE_ICON_STROKE[index % TILE_ICON_STROKE.length]} strokeWidth={1.5} />
        </div>
      )}
      <div style={{ position: 'relative', zIndex: 1, color: hasImages ? '#fff' : 'inherit' }}>
        <div style={{ fontFamily: 'var(--font-heading)', fontSize: big ? 24 : 18 }}>{category.nombre}</div>
        {big && <div style={{ fontSize: 12.5, opacity: hasImages ? 0.9 : 0.7, textDecoration: 'underline' }}>Explorar colección</div>}
      </div>
    </div>
  );
}

export function HomeClient({ initialBranding }: { initialBranding: BrandingConfig }) {
  const router = useRouter();
  // Seeded from the server-rendered fetch (see page.tsx) so the real store
  // name/hero image are already in the first paint — no flash of "Descubrí
  // Tienda Online" while a client-side fetch is in flight.
  const [branding, setBranding] = useState<BrandingConfig>(initialBranding);
  const [featured, setFeatured] = useState<Product[]>([]);
  const [featuredCategories, setFeaturedCategories] = useState<FeaturedCategory[]>([]);

  useEffect(() => {
    storeJson<BrandingConfig>('/api/store/content/branding', 'GET').then(setBranding).catch(() => {});
    storeJson<Paginated<Product>>('/api/store/products?destacado=true&pageSize=4', 'GET').then((p) => setFeatured(p.items));
    storeJson<FeaturedCategory[]>('/api/store/content/featured-categories', 'GET').then(setFeaturedCategories);
  }, []);

  const [bigCategory, ...smallCategories] = featuredCategories;

  const hasHeroImage = !!branding.heroImageUrl;

  return (
    <div>
      <section
        style={{
          position: 'relative',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
          minHeight: 420,
          display: 'flex',
          alignItems: 'center',
          background: hasHeroImage
            ? `url(${branding.heroImageUrl}) center/cover no-repeat`
            : 'linear-gradient(135deg, var(--color-accent-200), var(--color-accent-2-200))',
          marginBottom: 'var(--space-8)',
        }}
      >
        {hasHeroImage ? (
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(120deg, rgba(20,16,14,.6), rgba(20,16,14,.15) 65%)' }} />
        ) : (
          <div
            className="washed"
            style={{
              position: 'absolute',
              inset: 0,
              opacity: 0.5,
              background:
                'radial-gradient(circle at 30% 30%, var(--color-accent-300), transparent 60%), radial-gradient(circle at 75% 70%, var(--color-accent-2-300), transparent 55%)',
            }}
          />
        )}
        <Reveal>
          <div style={{ position: 'relative', padding: 'var(--space-8)', maxWidth: 520, color: hasHeroImage ? '#fff' : 'inherit' }}>
            <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 'var(--hero-h1-size, 46px)', lineHeight: 1.05, margin: '0 0 14px' }}>
              {branding.heroTitulo} {branding.nombre}
            </h1>
            <p style={{ fontSize: 16, opacity: hasHeroImage ? 0.9 : 0.75, margin: '0 0 24px', maxWidth: '44ch' }}>
              {branding.heroDescripcion}
            </p>
            <button type="button" className="btn btn-primary" onClick={() => router.push('/catalogo')}>
              Ver colección
              <Icon path='<path d="M5 12h14"/><path d="M12 5l7 7-7 7"/>' size={14} strokeWidth={2.75} />
            </button>
          </div>
        </Reveal>
      </section>

      {featuredCategories.length > 0 && (
        <Reveal>
          <section style={{ marginBottom: 'var(--space-8)' }}>
            <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: 'var(--hero-h2-size, 26px)', margin: '0 0 var(--space-4)' }}>Categorías destacadas</h2>
            <div className="category-hero">
              <CategoryTile category={bigCategory} index={0} big />
              {smallCategories.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                  {smallCategories.map((c, i) => (
                    <CategoryTile key={c.id} category={c} index={i + 1} big={false} />
                  ))}
                </div>
              )}
            </div>
          </section>
        </Reveal>
      )}

      <Reveal>
        <section>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 'var(--space-4)' }}>
            <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: 'var(--hero-h2-size, 26px)', margin: 0 }}>Productos destacados</h2>
            <a href="#" onClick={(e) => { e.preventDefault(); router.push('/catalogo'); }} style={{ fontSize: 12.5 }}>Ver todo →</a>
          </div>
          <div className="grid-4">
            {featured.map((p, i) => (
              <Reveal key={p.id} delay={i * 80}>
                <ProductCard product={p} showFavButton />
              </Reveal>
            ))}
          </div>
        </section>
      </Reveal>
    </div>
  );
}
